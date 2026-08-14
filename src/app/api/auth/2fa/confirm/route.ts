import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { verifyTotpCode, generateBackupCodes, hashBackupCode, isTotpConfigured } from "@/lib/totp";

const schema = z.object({
  secret: z.string().min(1),
  code: z.string().length(6),
});

/** Confirms enrollment: verifies the code the user entered actually matches
 * the secret they were shown, then persists the encrypted secret, flips
 * twoFactorEnabled on, and issues a fresh set of backup codes (shown once). */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  if (!isTotpConfigured()) {
    return NextResponse.json({ error: "Two-factor authentication is not configured on this server." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the 6-digit code from your authenticator app." }, { status: 400 });
  }

  const valid = await verifyTotpCode(parsed.data.secret, parsed.data.code);
  if (!valid) {
    return NextResponse.json({ error: "That code didn't match. Check your authenticator app and try again." }, { status: 400 });
  }

  const encryptedTotpSecret = encrypt(parsed.data.secret, "TOTP_SECRET_ENCRYPTION_KEY");
  const backupCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        encryptedTotpSecret,
        twoFactorEnabled: true,
        failedTotpAttempts: 0,
        totpLockedUntil: null,
      },
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({
      data: hashedCodes.map((codeHash) => ({ userId, codeHash })),
    }),
  ]);

  return NextResponse.json({ backupCodes });
}
