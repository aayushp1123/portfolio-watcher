import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateBackupCodes, hashBackupCode } from "@/lib/totp";

const schema = z.object({ password: z.string().min(1) });

/** Regenerates backup codes -- invalidates every existing code, including
 * unused ones, so a leaked old list can't be used after this. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorEnabled) {
    return NextResponse.json({ error: "Two-factor authentication isn't enabled." }, { status: 400 });
  }

  const valid = await bcrypt.compare(parsed.data.password, user.hashedPassword);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
  }

  const backupCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(backupCodes.map(hashBackupCode));

  await prisma.$transaction([
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
    prisma.twoFactorBackupCode.createMany({
      data: hashedCodes.map((codeHash) => ({ userId, codeHash })),
    }),
  ]);

  return NextResponse.json({ backupCodes });
}
