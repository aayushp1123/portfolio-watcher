import { prisma } from "@/lib/prisma";

export interface PortfolioHolding {
  ticker: string;
  name: string;
  shares: number;
  marketValue: number;
  costBasis: number | null;
}

export interface UserReportContext {
  userId: string;
  goal: {
    targetCoreEtfPct: number;
    targetGrowthPct: number;
    targetSpeculativePct: number;
    notes: string | null;
  } | null;
  exitRules: Array<{
    ticker: string;
    ruleType: string;
    value: number;
    note: string | null;
  }>;
  holdings: PortfolioHolding[];
  cashAvailable: number;
  /** Whether the user has an active Plaid connection at all — distinguishes
   * "connected account with $0 cash" from "no account connected, N/A". */
  hasBrokerageConnection: boolean;
  watchlist: Array<{ ticker: string; note: string | null }>;
}

/** Builds the per-user context passed into an AI report generation call. Reads
 * cached Plaid holdings data (from the last successful sync) rather than
 * calling Plaid live on every report — keeps report generation to a single
 * external dependency (Gemini) per run. */
export async function buildUserContext(userId: string): Promise<UserReportContext> {
  const [goal, exitRules, plaidItems, watchlistItems] = await Promise.all([
    prisma.goal.findUnique({ where: { userId } }),
    prisma.exitRule.findMany({ where: { userId, active: true } }),
    prisma.plaidItem.findMany({ where: { userId, status: "active" } }),
    prisma.watchlistItem.findMany({ where: { userId } }),
  ]);

  const holdings: PortfolioHolding[] = [];
  let cashAvailable = 0;

  for (const item of plaidItems) {
    if (!item.lastHoldingsJson) continue;
    try {
      const parsed = JSON.parse(item.lastHoldingsJson) as {
        holdings?: Array<{
          security_id: string;
          quantity: number;
          institution_value: number;
          cost_basis: number | null;
        }>;
        securities?: Array<{
          security_id: string;
          ticker_symbol: string | null;
          name: string | null;
          type: string;
        }>;
      };

      const securityById = new Map((parsed.securities ?? []).map((s) => [s.security_id, s]));

      for (const h of parsed.holdings ?? []) {
        const security = securityById.get(h.security_id);
        if (!security) continue;
        if (security.type === "cash") {
          cashAvailable += h.institution_value;
          continue;
        }
        if (!security.ticker_symbol) continue;

        holdings.push({
          ticker: security.ticker_symbol,
          name: security.name ?? security.ticker_symbol,
          shares: h.quantity,
          marketValue: h.institution_value,
          costBasis: h.cost_basis,
        });
      }
    } catch {
      // Skip malformed cached holdings for this item rather than failing the whole report.
    }
  }

  return {
    userId,
    goal: goal
      ? {
          targetCoreEtfPct: goal.targetCoreEtfPct,
          targetGrowthPct: goal.targetGrowthPct,
          targetSpeculativePct: goal.targetSpeculativePct,
          notes: goal.notes,
        }
      : null,
    exitRules: exitRules.map((r) => ({
      ticker: r.ticker,
      ruleType: r.ruleType,
      value: r.value,
      note: r.note,
    })),
    holdings,
    cashAvailable,
    hasBrokerageConnection: plaidItems.length > 0,
    watchlist: watchlistItems.map((w) => ({ ticker: w.ticker, note: w.note })),
  };
}
