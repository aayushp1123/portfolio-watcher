import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAiConfigured } from "@/lib/gemini";
import { generateDailyDigest } from "@/lib/reports/dailyDigest";
import { generateWeeklyTrends } from "@/lib/reports/weeklyTrends";
import { generateBreakingNews } from "@/lib/reports/breakingNews";

const VALID_TYPES = ["DAILY_DIGEST", "WEEKLY_TRENDS", "BREAKING_NEWS"] as const;
type ReportTypeParam = (typeof VALID_TYPES)[number];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Checked first, before touching the Gemini client at all — this route
  // must be a total no-op with no external call when no key is configured.
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI reports are not configured. Add GEMINI_API_KEY to enable this." },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const type: ReportTypeParam = VALID_TYPES.includes(body?.type) ? body.type : "DAILY_DIGEST";

  const userId = (session.user as { id: string }).id;

  try {
    switch (type) {
      case "DAILY_DIGEST":
        return NextResponse.json(await generateDailyDigest(userId));
      case "WEEKLY_TRENDS":
        return NextResponse.json(await generateWeeklyTrends(userId));
      case "BREAKING_NEWS":
        return NextResponse.json(await generateBreakingNews(userId));
    }
  } catch (err) {
    console.error("Report generation error", err);
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
