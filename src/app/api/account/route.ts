import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Permanently deletes the logged-in user's account. All related data
 * (goal, exit rules, watchlist, Plaid connections, reports) cascades via
 * the schema's onDelete: Cascade relations. */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  await prisma.user.delete({ where: { id: userId } });

  return NextResponse.json({ ok: true });
}
