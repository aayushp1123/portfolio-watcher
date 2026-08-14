import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ password: z.string().min(1) });

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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const valid = await bcrypt.compare(parsed.data.password, user.hashedPassword);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        encryptedTotpSecret: null,
        twoFactorEnabled: false,
        failedTotpAttempts: 0,
        totpLockedUntil: null,
      },
    }),
    prisma.twoFactorBackupCode.deleteMany({ where: { userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
