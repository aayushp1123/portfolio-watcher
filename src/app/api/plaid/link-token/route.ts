import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { CountryCode, Products } from "plaid";
import { authOptions } from "@/lib/auth";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured" }, { status: 503 });
  }

  const userId = (session.user as { id: string }).id;
  const client = getPlaidClient();

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Portfolio Watcher",
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ linkToken: response.data.link_token });
  } catch (err) {
    console.error("Plaid link-token error", err);
    return NextResponse.json({ error: "Could not create link token" }, { status: 500 });
  }
}
