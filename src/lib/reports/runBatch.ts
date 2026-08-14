import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid";
import { decrypt } from "@/lib/crypto";
import { getSharedMarketContext, type SharedMarketContext } from "@/lib/reports/buildContext";
import { generateDailyDigest } from "@/lib/reports/dailyDigest";
import { generateWeeklyTrends } from "@/lib/reports/weeklyTrends";
import { generateBreakingNews } from "@/lib/reports/breakingNews";

type ReportKind = "DAILY_DIGEST" | "WEEKLY_TRENDS" | "BREAKING_NEWS";

const generators: Record<ReportKind, (userId: string, shared?: SharedMarketContext) => Promise<unknown>> = {
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

/** How many consecutive quota-exhaustion-style failures in a row before we
 * stop launching new AI calls for the rest of this batch run. As the user
 * count grows, the fixed daily AI quota can run out mid-batch -- past this
 * point, every remaining call would just fail the same way, so there's no
 * value in still making the request. */
const QUOTA_CIRCUIT_BREAKER_THRESHOLD = 3;

function isQuotaExhaustedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(message);
}

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
 * Vercel Cron routes.
 *
 * Two things keep this fair and efficient as the user count grows against a
 * fixed daily AI quota shared across every user:
 * - SPY momentum/VIX/macro/SPY-closes are identical for every user this run,
 *   so they're fetched once (getSharedMarketContext) instead of per user.
 * - Users are processed in order of whoever's gone longest without a report
 *   of this kind (oldest generatedAt / never-generated first), so if quota
 *   runs out mid-batch, it's always the same handful of already-recently-
 *   served users who get skipped, not an arbitrary/fixed subset every run —
 *   the ones skipped today sort to the front again next scheduled run. */
export async function runForAllUsers(kind: ReportKind): Promise<{ userCount: number; skippedForQuota: number }> {
  const users = await prisma.user.findMany({
    where: { OR: [{ plaidItems: { some: { status: "active" } } }, { watchlistItems: { some: {} } }] },
    select: {
      id: true,
      reports: {
        where: { type: kind },
        orderBy: { generatedAt: "desc" },
        take: 1,
        select: { generatedAt: true },
      },
    },
  });

  const sortedUsers = [...users].sort((a, b) => {
    const aTime = a.reports[0]?.generatedAt.getTime() ?? 0;
    const bTime = b.reports[0]?.generatedAt.getTime() ?? 0;
    return aTime - bTime;
  });

  const shared = await getSharedMarketContext();
  const limit = pLimit(3);
  const generate = generators[kind];

  let quotaExhausted = false;
  let consecutiveQuotaFailures = 0;
  let skippedForQuota = 0;

  await Promise.all(
    sortedUsers.map((u) =>
      limit(async () => {
        if (quotaExhausted) {
          skippedForQuota++;
          console.log(`[cron] ${kind} skipping user ${u.id} — AI quota exhausted this run, will retry next scheduled run`);
          return;
        }
        try {
          if (needsFreshHoldings[kind]) {
            await refreshHoldings(u.id);
          }
          await generate(u.id, shared);
          consecutiveQuotaFailures = 0;
        } catch (err) {
          // One user's failure (e.g. an expired Plaid connection) must
          // never take down the batch for everyone else.
          console.error(`[cron] ${kind} failed for user ${u.id}:`, err);
          if (isQuotaExhaustedError(err)) {
            consecutiveQuotaFailures++;
            if (consecutiveQuotaFailures >= QUOTA_CIRCUIT_BREAKER_THRESHOLD) {
              quotaExhausted = true;
            }
          } else {
            consecutiveQuotaFailures = 0;
          }
        }
      })
    )
  );

  return { userCount: users.length, skippedForQuota };
}
