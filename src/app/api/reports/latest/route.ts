import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ReportType } from "@/generated/prisma/enums";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "DAILY_DIGEST") as ReportType;

  const report = await prisma.report.findFirst({
    where: { userId, type },
    orderBy: { generatedAt: "desc" },
  });

  if (!report) return NextResponse.json({ report: null });

  return NextResponse.json({
    report: {
      ...report,
      content: JSON.parse(report.content),
    },
  });
}
