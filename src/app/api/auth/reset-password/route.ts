import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
  });

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { hashedPassword } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: resetToken.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
