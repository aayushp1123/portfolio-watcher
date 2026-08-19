import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  await prisma.user.update({
    where: { id: userId },
    data: { termsAcceptedVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
