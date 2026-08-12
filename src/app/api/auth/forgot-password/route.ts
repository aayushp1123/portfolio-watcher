import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mailer";

const schema = z.object({ email: z.string().email() });

const GENERIC_MESSAGE = "If an account exists for that email, we've sent a password reset link.";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Always return the same generic message whether or not the account
  // exists, to avoid leaking which emails are registered.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ message: GENERIC_MESSAGE });
  }

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    console.error("[forgot-password] failed to send email:", err);
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
