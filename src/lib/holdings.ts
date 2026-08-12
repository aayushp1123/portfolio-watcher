import { prisma } from "@/lib/prisma";

export interface RawHolding {
  ticker: string;
  name: string;
  shares: number;
  marketValue: number;
  costBasis: number | null;
}

/** Parses cached Plaid holdings JSON (from the last successful sync) into a
 * flat list of positions plus total cash, skipping any malformed cached item
 * rather than failing the caller. Shared by report generation and the
 * on-demand dashboard snapshot so both read holdings the same way. */
export async function getParsedHoldings(
  userId: string
): Promise<{ rawHoldings: RawHolding[]; cashAvailable: number; hasBrokerageConnection: boolean }> {
  const plaidItems = await prisma.plaidItem.findMany({ where: { userId, status: "active" } });

  const rawHoldings: RawHolding[] = [];
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

        rawHoldings.push({
          ticker: security.ticker_symbol,
          name: security.name ?? security.ticker_symbol,
          shares: h.quantity,
          marketValue: h.institution_value,
          costBasis: h.cost_basis,
        });
      }
    } catch {
      // Skip malformed cached holdings for this item rather than failing the caller.
    }
  }

  return { rawHoldings, cashAvailable, hasBrokerageConnection: plaidItems.length > 0 };
}
