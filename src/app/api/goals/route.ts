import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const goalSchema = z
  .object({
    targetCoreEtfPct: z.number().min(0).max(100),
    targetGrowthPct: z.number().min(0).max(100),
    targetSpeculativePct: z.number().min(0).max(100),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (d) => Math.abs(d.targetCoreEtfPct + d.targetGrowthPct + d.targetSpeculativePct - 100) < 0.01,
    { message: "Allocation percentages must add up to 100" }
  );

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const goal = await prisma.goal.findUnique({ where: { userId } });
  return NextResponse.json({ goal });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json().catch(() => null);
  const parsed = goalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const goal = await prisma.goal.upsert({
    where: { userId },
    update: parsed.data,
    create: { ...parsed.data, userId },
  });

  return NextResponse.json({ goal });
}
