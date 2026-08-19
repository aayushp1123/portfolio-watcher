// ============================================================================
// IMPORTS
// ============================================================================
import pLimit from "p-limit"; // this brings in the library that limits how many report generations run at the same time
import { prisma } from "@/lib/prisma"; // this brings in the shared database client used for every query in this file
import { getPlaidClient, isPlaidConfigured } from "@/lib/plaid"; // this brings in the Plaid API client and a helper that checks if Plaid keys are set
import { decrypt } from "@/lib/crypto"; // this brings in the function that decrypts a user's saved Plaid access token
import { getSharedMarketContext, type SharedMarketContext } from "@/lib/reports/buildContext"; // this brings in the function that fetches SPY/VIX/macro data once for the whole batch
import { generateDailyDigest } from "@/lib/reports/dailyDigest"; // this brings in the function that writes a Daily Digest report for one user
import { generateWeeklyTrends } from "@/lib/reports/weeklyTrends"; // this brings in the function that writes a Weekly Trends report for one user
import { generateBreakingNews } from "@/lib/reports/breakingNews"; // this brings in the function that writes a Breaking News report for one user

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================
type ReportKind = "DAILY_DIGEST" | "WEEKLY_TRENDS" | "BREAKING_NEWS"; // this defines the three report types this file knows how to generate

const generators: Record<ReportKind, (userId: string, shared?: SharedMarketContext) => Promise<unknown>> = {
  // this builds a lookup table so the rest of the file can call the right generator just by knowing the report kind string
  DAILY_DIGEST: generateDailyDigest, // this says "DAILY_DIGEST" maps to the daily digest generator function
  WEEKLY_TRENDS: generateWeeklyTrends, // this says "WEEKLY_TRENDS" maps to the weekly trends generator function
  BREAKING_NEWS: generateBreakingNews, // this says "BREAKING_NEWS" maps to the breaking news generator function
};

/** Only holdings-based report types need a fresh Plaid pull first.
 * Currently all three kinds are true, so this gate is a no-op today —
 * kept in place for the day a non-holdings report kind is added. */
const needsFreshHoldings: Record<ReportKind, boolean> = {
  DAILY_DIGEST: true, // this says Daily Digest needs a fresh Plaid pull before it runs
  WEEKLY_TRENDS: true, // this says Weekly Trends needs a fresh Plaid pull before it runs
  BREAKING_NEWS: true, // this says Breaking News needs a fresh Plaid pull before it runs
};

/** How many consecutive quota-exhaustion-style failures in a row before we
 * stop launching new AI calls for the rest of this batch run. As the user
 * count grows, the fixed daily AI quota can run out mid-batch -- past this
 * point, every remaining call would just fail the same way, so there's no
 * value in still making the request.
 * Note: with pLimit(3) below, "in a row" means consecutive in completion
 * order across up to 3 concurrent slots, not strict sequential retry order —
 * close enough for the purpose of not hammering a dead quota. */
const QUOTA_CIRCUIT_BREAKER_THRESHOLD = 3; // this sets how many quota failures in a row will stop the batch from trying any more users

// ============================================================================
// HELPER: isQuotaExhaustedError — decides if a caught error looks like a quota/rate-limit rejection
// ============================================================================
function isQuotaExhaustedError(err: unknown): boolean { // this defines a function that checks whether a given error looks like a quota/rate-limit rejection
  const message = err instanceof Error ? err.message : String(err); // this pulls the error's text out, whether it's a real Error object or something else that was thrown
  return /429|quota|RESOURCE_EXHAUSTED|rate.?limit/i.test(message); // this checks whether the error text contains any of the known quota/rate-limit phrases
}

// ============================================================================
// HELPER: Plaid error type guard — lets the code safely read Plaid's error_code field
// ============================================================================
interface PlaidApiErrorShape { // this defines the minimal shape of a Plaid SDK error so TypeScript knows what fields are safe to read
  response?: { data?: { error_code?: string } }; // this says a Plaid error may have a response.data.error_code string buried inside it
}

function isPlaidError(err: unknown): err is PlaidApiErrorShape { // this defines a function that checks whether a caught error actually came from the Plaid SDK
  return typeof err === "object" && err !== null && "response" in err; // this checks the error is a non-null object with a "response" field, which is how Plaid SDK errors are shaped
}

// ============================================================================
// FUNCTION: refreshHoldings — re-pulls live Plaid holdings for one user before their report runs
// ============================================================================
/** Re-pulls live holdings from Plaid for every active connection this user has,
 * so trades/buys/sells show up in the very next scheduled report — no manual
 * "Sync Now" click required. Failures are logged and skipped per-item; a
 * stale cached snapshot is better than blocking the whole report. A broken
 * connection is marked login_required/error (same as the manual Sync route)
 * so it stops being retried every run and the UI reflects it.
 *
 * Also guards against a real Plaid glitch seen in production: a sync can
 * succeed (no error thrown) but return a suspiciously incomplete holdings
 * list (e.g. 2 positions instead of the usual 9), which would otherwise get
 * cached as-is and silently corrupt the portfolio-value history with a fake
 * crash-and-recover. A majority of positions vanishing in a single sync
 * while the connection itself reports healthy is treated as a bad sync, not
 * a real liquidation — the previous cached holdings are kept instead. */
async function refreshHoldings(userId: string) { // this defines the function that refreshes one user's live Plaid holdings
  if (!isPlaidConfigured()) return; // this stops immediately if no Plaid API keys are set up at all, since there's nothing to refresh

  const items = await prisma.plaidItem.findMany({ where: { userId, status: "active" } }); // this loads every brokerage connection this user has that is currently marked as working
  if (items.length === 0) return; // this stops immediately if the user has no working brokerage connections to refresh

  const client = getPlaidClient(); // this creates one Plaid API client to reuse for every connection below
  await Promise.all( // this runs the refresh for every connection at the same time instead of one at a time
    items.map(async (item) => { // this loops over every active brokerage connection this user has
      try {
        const accessToken = decrypt(item.encryptedAccessToken); // this decrypts the saved access token so it can be used to call Plaid
        const holdingsRes = await client.investmentsHoldingsGet({ access_token: accessToken }); // this calls Plaid to fetch this connection's current live holdings
        const newCount = holdingsRes.data.holdings?.length ?? 0; // this counts how many positions the fresh Plaid response actually contains

        let previousCount: number | null = null; // this will hold how many positions the last cached snapshot had, if any
        if (item.lastHoldingsJson) { // this checks whether there's a previous cached snapshot to compare against
          try {
            const previous = JSON.parse(item.lastHoldingsJson) as { holdings?: unknown[] }; // this parses the previous snapshot the same way the fresh one is shaped
            previousCount = previous.holdings?.length ?? null; // this reads how many positions were in that previous snapshot
          } catch {
            previousCount = null; // this treats an unparseable previous snapshot as "nothing to compare against" rather than crashing
          }
        }

        // A real, legitimate full liquidation is rare and wouldn't also
        // recover back to the old position count on the very next sync the
        // way the production incident that motivated this check did.
        const looksIncomplete = previousCount != null && previousCount >= 3 && newCount < previousCount / 2; // this flags a sync that lost more than half of a previously-substantial holdings list

        if (looksIncomplete) { // this checks whether this sync's result looks like a bad/incomplete Plaid response rather than a real change
          console.error(
            `[cron] holdings refresh for plaidItem ${item.id} looked incomplete (${newCount} positions vs previous ${previousCount}) — keeping previous cached holdings`
          ); // this logs the suspicious sync so it's visible in Vercel's logs
          await prisma.plaidItem.update({ // this still marks the connection as healthy and synced, just without overwriting the holdings themselves
            where: { id: item.id }, // this targets the specific connection that was just refreshed
            data: { status: "active", lastSyncedAt: new Date() }, // this updates the sync timestamp but deliberately leaves lastHoldingsJson untouched
          });
          return; // this skips the normal save below for this connection
        }

        await prisma.plaidItem.update({ // this saves the fresh holdings back to the database
          where: { id: item.id }, // this targets the specific connection that was just refreshed
          data: { status: "active", lastHoldingsJson: JSON.stringify(holdingsRes.data), lastSyncedAt: new Date() }, // this stores the new holdings, marks the connection active again, and stamps the sync time
        });
      } catch (err) {
        console.error(`[cron] holdings refresh failed for plaidItem ${item.id}:`, err); // this logs the failure so it shows up in Vercel's logs
        const errorCode = isPlaidError(err) ? err.response?.data?.error_code : undefined; // this pulls out Plaid's specific error code if this was a real Plaid API error
        try {
          await prisma.plaidItem.update({ // this marks the connection as broken so it stops being silently retried forever
            where: { id: item.id }, // this targets the specific connection that just failed
            data: { status: errorCode === "ITEM_LOGIN_REQUIRED" ? "login_required" : "error" }, // this sets the status to "needs reconnect" if that's the specific reason, otherwise a generic error
          });
        } catch (updateErr) {
          console.error(`[cron] failed to mark plaidItem ${item.id} as broken:`, updateErr); // this logs that even saving the broken status failed, without crashing the batch
        }
      }
    })
  );
}

// ============================================================================
// FUNCTION: runForAllUsers — the main batch entry point called by the Vercel Cron routes
// ============================================================================
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
export async function runForAllUsers(kind: ReportKind): Promise<{ userCount: number; skippedForQuota: number }> { // this defines the main function the cron routes call to generate one report kind for every eligible user
  const users = await prisma.user.findMany({ // this loads every user who is eligible for this report
    where: { OR: [{ plaidItems: { some: { status: "active" } } }, { watchlistItems: { some: {} } }] }, // this includes anyone with a working brokerage connection or at least one watchlist ticker
    select: {
      id: true, // this grabs the user's id
      reports: { // this grabs a bit of that user's report history
        where: { type: kind }, // this only looks at past reports of the same kind being generated right now
        orderBy: { generatedAt: "desc" }, // this orders those past reports newest first
        take: 1, // this keeps only the single most recent one
        select: { generatedAt: true }, // this only pulls the timestamp, not the full report content
      },
    },
  });

  const sortedUsers = users.sort((a, b) => { // this sorts the user list in place so the longest-waiting users go first
    const aTime = a.reports[0]?.generatedAt.getTime() ?? 0; // this reads when user A last got this report, or 0 if they've never gotten one
    const bTime = b.reports[0]?.generatedAt.getTime() ?? 0; // this reads when user B last got this report, or 0 if they've never gotten one
    return aTime - bTime; // this puts whoever was served longer ago (or never) earlier in the list
  });

  const shared = await getSharedMarketContext(); // this fetches SPY/VIX/macro data once, so every user's report reuses the same numbers instead of re-fetching them
  const limit = pLimit(3); // this sets the batch to process at most 3 users' reports at the same time
  const generate = generators[kind]; // this picks out the correct generator function for the report kind being run

  let quotaExhausted = false; // this tracks whether the AI quota has been declared dead for the rest of this run
  let consecutiveQuotaFailures = 0; // this counts how many quota-style failures have happened in a row
  let skippedForQuota = 0; // this counts how many users got skipped once the quota was declared dead

  await Promise.all( // this waits for every user's processing to finish before returning
    sortedUsers.map((u) => // this goes through the fairness-sorted user list
      limit(async () => { // this runs each user's work through the concurrency limiter
        if (quotaExhausted) { // this checks whether an earlier user in this same run already tripped the circuit breaker
          skippedForQuota++; // this counts this user as skipped
          console.log(`[cron] ${kind} skipping user ${u.id} — AI quota exhausted this run, will retry next scheduled run`); // this logs which user got skipped and why
          return; // this stops here without even attempting this user's report
        }
        try {
          if (needsFreshHoldings[kind]) { // this checks whether this report kind needs live Plaid holdings first
            await refreshHoldings(u.id); // this pulls this user's fresh holdings before their report is generated
          }
          await generate(u.id, shared); // this actually generates the report for this user, using the shared market data
          consecutiveQuotaFailures = 0; // this resets the quota-failure streak since this user succeeded
        } catch (err) {
          // One user's failure (e.g. an expired Plaid connection) must
          // never take down the batch for everyone else.
          console.error(`[cron] ${kind} failed for user ${u.id}:`, err); // this logs which user failed and why, without stopping the batch
          if (isQuotaExhaustedError(err)) { // this checks whether this specific failure looks like a quota/rate-limit rejection
            consecutiveQuotaFailures++; // this adds one to the quota-failure streak
            if (consecutiveQuotaFailures >= QUOTA_CIRCUIT_BREAKER_THRESHOLD) { // this checks whether the streak has hit the trip point
              quotaExhausted = true; // this declares the quota dead for the rest of this run
            }
          } else {
            consecutiveQuotaFailures = 0; // this resets the streak since this failure wasn't a quota issue
          }
        }
      })
    )
  );

  return { userCount: users.length, skippedForQuota }; // this returns how many users were eligible this run and how many got skipped for quota
}
