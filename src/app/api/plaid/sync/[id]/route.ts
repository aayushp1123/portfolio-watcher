import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid";
import { decrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

interface PlaidApiErrorShape {
  response?: { data?: { error_code?: string } };
}

function isPlaidError(err: unknown): err is PlaidApiErrorShape {
  return typeof err === "object" && err !== null && "response" in err;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured" }, { status: 503 });
  }

  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const item = await prisma.plaidItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = getPlaidClient();
  const accessToken = decrypt(item.encryptedAccessToken);

  try {
    const holdingsRes = await client.investmentsHoldingsGet({ access_token: accessToken });
    await prisma.plaidItem.update({
      where: { id },
      data: {
        status: "active",
        lastHoldingsJson: JSON.stringify(holdingsRes.data),
        lastSyncedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, status: "active" });
  } catch (err) {
    const errorCode = isPlaidError(err) ? err.response?.data?.error_code : undefined;

    if (errorCode === "ITEM_LOGIN_REQUIRED") {
      await prisma.plaidItem.update({ where: { id }, data: { status: "login_required" } });
      return NextResponse.json(
        { error: "This connection needs to be re-authenticated.", status: "login_required" },
        { status: 409 }
      );
    }

    console.error("Plaid sync error", err);
    await prisma.plaidItem.update({ where: { id }, data: { status: "error" } });
    return NextResponse.json({ error: "Could not sync this account" }, { status: 500 });
  }
}
