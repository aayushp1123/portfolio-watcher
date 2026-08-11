import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid";
import { decrypt } from "@/lib/crypto";
import { generateDailyDigest } from "@/lib/reports/dailyDigest";
import { generateWeeklyTrends } from "@/lib/reports/weeklyTrends";
import { generateBreakingNews } from "@/lib/reports/breakingNews";

type ReportKind = "DAILY_DIGEST" | "WEEKLY_TRENDS" | "BREAKING_NEWS";

const generators: Record<ReportKind, (userId: string) => Promise<unknown>> = {
  DAILY_DIGEST: generateDailyDigest,
  WEEKLY_TRENDS: generateWeeklyTrends,
  BREAKING_NEWS: generateBreakingNews,
};

/** Only holdings-based report types need a fresh Plaid pull first. */
const needsFreshHoldings: Record<ReportKind, boolean> = {
  DAILY_DIGEST: true,
  WEEKLY_TRENDS: true,
  BREAKING_NEWS: true,
};

/** Re-pulls live holdings from Plaid for every active connection this user has,
 * so trades/buys/sells show up in the very next scheduled report — no manual
 * "Sync Now" click required. Failures are logged and skipped per-item; a
 * stale cached snapshot is better than blocking the whole report. */
async function refreshHoldings(userId: string) {
  if (!isPlaidConfigured()) return;

  const items = await prisma.plaidItem.findMany({ where: { userId, status: "active" } });
  if (items.length === 0) return;

  const client = getPlaidClient();
  await Promise.all(
    items.map(async (item) => {
      try {
        const accessToken = decrypt(item.encryptedAccessToken);
        const holdingsRes = await client.investmentsHoldingsGet({ access_token: accessToken });
        await prisma.plaidItem.update({
          where: { id: item.id },
          data: { lastHoldingsJson: JSON.stringify(holdingsRes.data), lastSyncedAt: new Date() },
        });
      } catch (err) {
        console.error(`[cron] holdings refresh failed for plaidItem ${item.id}:`, err);
      }
    })
  );
}

/** Runs a report generator for every user who has something to report on
 * (an active brokerage connection and/or watchlist tickers). Called by the
 * Vercel Cron routes. */
export async function runForAllUsers(kind: ReportKind): Promise<{ userCount: number }> {
  const users = await prisma.user.findMany({
    where: { OR: [{ plaidItems: { some: { status: "active" } } }, { watchlistItems: { some: {} } }] },
    select: { id: true },
  });

  const limit = pLimit(3);
  const generate = generators[kind];

  await Promise.all(
    users.map((u) =>
      limit(async () => {
        try {
          if (needsFreshHoldings[kind]) {
            await refreshHoldings(u.id);
          }
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
