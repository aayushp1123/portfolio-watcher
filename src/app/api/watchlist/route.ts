import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  ticker: z.string().min(1).max(10).transform((s) => s.toUpperCase()),
  note: z.string().max(500).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const watchlistItems = await prisma.watchlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ watchlistItems });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const existing = await prisma.watchlistItem.findUnique({
    where: { userId_ticker: { userId, ticker: parsed.data.ticker } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already on your watchlist" }, { status: 409 });
  }

  const watchlistItem = await prisma.watchlistItem.create({
    data: { ...parsed.data, userId },
  });
  return NextResponse.json({ watchlistItem }, { status: 201 });
}
