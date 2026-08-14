import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateTotpSecret, getTotpQrCode, isTotpConfigured } from "@/lib/totp";

/** Starts 2FA enrollment. Nothing is persisted here -- the secret is only
 * saved once the user proves they can generate a valid code from it in
 * /api/auth/2fa/confirm, avoiding half-finished setups left in the DB. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isTotpConfigured()) {
    return NextResponse.json({ error: "Two-factor authentication is not configured on this server." }, { status: 503 });
  }

  const email = (session.user as { email?: string }).email ?? "";
  const secret = generateTotpSecret();
  const qrCode = await getTotpQrCode(email, secret);

  return NextResponse.json({ secret, qrCode });
}
