import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/gemini";
import { runForAllUsers } from "@/lib/reports/runBatch";

export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json({ skipped: true, reason: "GEMINI_API_KEY not set" });
  }

  const result = await runForAllUsers("WEEKLY_TRENDS");
  return NextResponse.json({ ok: true, ...result });
}
