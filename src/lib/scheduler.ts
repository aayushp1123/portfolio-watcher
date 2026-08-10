import cron from "node-cron";
import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { isAiConfigured } from "@/lib/anthropic";
import { generateDailyDigest } from "@/lib/reports/dailyDigest";
import { generateWeeklyTrends } from "@/lib/reports/weeklyTrends";
import { generateBreakingNews } from "@/lib/reports/breakingNews";

type ReportKind = "DAILY_DIGEST" | "WEEKLY_TRENDS" | "BREAKING_NEWS";

const generators: Record<ReportKind, (userId: string) => Promise<unknown>> = {
  DAILY_DIGEST: generateDailyDigest,
  WEEKLY_TRENDS: generateWeeklyTrends,
  BREAKING_NEWS: generateBreakingNews,
};

const runningGuard = new Set<ReportKind>();

async function runForAllUsers(kind: ReportKind) {
  if (runningGuard.has(kind)) {
    console.log(`[scheduler] ${kind} run already in progress, skipping this tick`);
    return;
  }
  runningGuard.add(kind);

  try {
    const users = await prisma.user.findMany({
      where: { plaidItems: { some: { status: "active" } } },
      select: { id: true },
    });

    const limit = pLimit(3);
    const generate = generators[kind];

    await Promise.all(
      users.map((u) =>
        limit(async () => {
          try {
            await generate(u.id);
          } catch (err) {
            // One user's failure (e.g. an expired Plaid connection) must
            // never take down the batch for everyone else.
            console.error(`[scheduler] ${kind} failed for user ${u.id}:`, err);
          }
        })
      )
    );

    console.log(`[scheduler] ${kind} run complete for ${users.length} user(s)`);
  } finally {
    runningGuard.delete(kind);
  }
}

let started = false;

export function startScheduler() {
  if (started) return;

  if (!isAiConfigured()) {
    console.log("[scheduler] ANTHROPIC_API_KEY not set — scheduler will not start. This is expected until you add a key.");
    return;
  }

  started = true;

  const dailyExpr = process.env.CRON_DAILY_DIGEST || "0 7 * * *";
  const weeklyExpr = process.env.CRON_WEEKLY_TRENDS || "0 8 * * 1";
  const breakingExpr = process.env.CRON_BREAKING_NEWS || "0 */2 * * *";

  cron.schedule(dailyExpr, () => runForAllUsers("DAILY_DIGEST"));
  cron.schedule(weeklyExpr, () => runForAllUsers("WEEKLY_TRENDS"));
  cron.schedule(breakingExpr, () => runForAllUsers("BREAKING_NEWS"));

  console.log(
    `[scheduler] started — daily "${dailyExpr}", weekly "${weeklyExpr}", breaking news "${breakingExpr}"`
  );
}
