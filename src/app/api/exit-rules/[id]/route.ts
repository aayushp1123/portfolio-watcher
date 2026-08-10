import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  value: z.number().positive().optional(),
  note: z.string().max(500).optional(),
  active: z.boolean().optional(),
});

async function getOwnedRule(userId: string, id: string) {
  const rule = await prisma.exitRule.findUnique({ where: { id } });
  if (!rule || rule.userId !== userId) return null;
  return rule;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { id } = await params;
  const existing = await getOwnedRule(userId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const exitRule = await prisma.exitRule.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ exitRule });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { id } = await params;
  const existing = await getOwnedRule(userId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.exitRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
