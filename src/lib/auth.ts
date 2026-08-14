import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { verifyTotpCode, findMatchingBackupCode } from "@/lib/totp";

const TOTP_LOCKOUT_THRESHOLD = 5;
const TOTP_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
/** Outer ceiling for how long a "remember me" session's cookie can physically
 * live -- the actual effective length for non-remembered sessions is
 * enforced separately below (DEFAULT_SESSION_MS), inside the token itself. */
const REMEMBER_ME_SESSION_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_SESSION_MS = 24 * 60 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: REMEMBER_ME_SESSION_SECONDS },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "Two-factor code", type: "text" },
        remember: { label: "Remember me", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) return null;

        const validPassword = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!validPassword) return null;

        if (user.twoFactorEnabled) {
          if (user.totpLockedUntil && user.totpLockedUntil > new Date()) {
            throw new Error("2FA_LOCKED");
          }

          const code = credentials.totpCode?.trim();
          if (!code) {
            throw new Error("2FA_REQUIRED");
          }

          let valid = false;
          let usedBackupCodeId: string | null = null;

          if (user.encryptedTotpSecret) {
            const secret = decrypt(user.encryptedTotpSecret, "TOTP_SECRET_ENCRYPTION_KEY");
            valid = await verifyTotpCode(secret, code);
          }

          if (!valid) {
            const backupCodes = await prisma.twoFactorBackupCode.findMany({
              where: { userId: user.id, usedAt: null },
              select: { id: true, codeHash: true },
            });
            usedBackupCodeId = await findMatchingBackupCode(code, backupCodes);
            valid = usedBackupCodeId !== null;
          }

          if (!valid) {
            const failedAttempts = user.failedTotpAttempts + 1;
            const locked = failedAttempts >= TOTP_LOCKOUT_THRESHOLD;
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedTotpAttempts: locked ? 0 : failedAttempts,
                totpLockedUntil: locked ? new Date(Date.now() + TOTP_LOCKOUT_DURATION_MS) : null,
              },
            });
            throw new Error(locked ? "2FA_LOCKED" : "2FA_INVALID");
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { failedTotpAttempts: 0, totpLockedUntil: null },
          });
          if (usedBackupCodeId) {
            await prisma.twoFactorBackupCode.update({
              where: { id: usedBackupCodeId },
              data: { usedAt: new Date() },
            });
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          remember: credentials.remember === "true",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.rememberMe = (user as { remember?: boolean }).remember ?? false;
        token.loginAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      const rememberMe = (token.rememberMe as boolean | undefined) ?? false;
      const loginAt = (token.loginAt as number | undefined) ?? Date.now();
      const expired = !rememberMe && Date.now() - loginAt > DEFAULT_SESSION_MS;

      if (expired) {
        session.user = undefined;
        return session;
      }

      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};
