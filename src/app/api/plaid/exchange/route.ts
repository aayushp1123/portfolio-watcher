import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid";
import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ publicToken: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured" }, { status: 503 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing public token" }, { status: 400 });
  }

  const client = getPlaidClient();

  try {
    const exchange = await client.itemPublicTokenExchange({
      public_token: parsed.data.publicToken,
    });
    const accessToken = exchange.data.access_token;
    const plaidItemId = exchange.data.item_id;

    let institutionName: string | undefined;
    try {
      const itemRes = await client.itemGet({ access_token: accessToken });
      const institutionId = itemRes.data.item.institution_id;
      if (institutionId) {
        const instRes = await client.institutionsGetById({
          institution_id: institutionId,
          country_codes: ["US" as never],
        });
        institutionName = instRes.data.institution.name;
      }
    } catch {
      // Non-fatal — institution name is a nice-to-have.
    }

    const holdingsRes = await client.investmentsHoldingsGet({ access_token: accessToken });

    await prisma.plaidItem.create({
      data: {
        userId,
        plaidItemId,
        encryptedAccessToken: encrypt(accessToken),
        institutionName,
        status: "active",
        lastHoldingsJson: JSON.stringify(holdingsRes.data),
        lastSyncedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, institutionName, holdings: holdingsRes.data });
  } catch (err) {
    console.error("Plaid exchange error", err);
    return NextResponse.json({ error: "Could not connect that account" }, { status: 500 });
  }
}
