import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { generateDailyDigest } from "@/lib/reports/dailyDigest";
import { generateWeeklyTrends } from "@/lib/reports/weeklyTrends";
import { generateBreakingNews } from "@/lib/reports/breakingNews";

type ReportKind = "DAILY_DIGEST" | "WEEKLY_TRENDS" | "BREAKING_NEWS";

const generators: Record<ReportKind, (userId: string) => Promise<unknown>> = {
  DAILY_DIGEST: generateDailyDigest,
  WEEKLY_TRENDS: generateWeeklyTrends,
  BREAKING_NEWS: generateBreakingNews,
};

/** Runs a report generator for every user with an active brokerage connection. Called by the Vercel Cron routes. */
export async function runForAllUsers(kind: ReportKind): Promise<{ userCount: number }> {
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
          console.error(`[cron] ${kind} failed for user ${u.id}:`, err);
        }
      })
    )
  );

  return { userCount: users.length };
}
