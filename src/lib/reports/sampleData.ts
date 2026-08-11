import type { DailyDigest, WeeklyTrends, BreakingNews } from "./schemas";

/**
 * Hardcoded fixtures — never touch the network or the Anthropic API.
 * Shown on the public /sample pages so a visitor can see what their own
 * dashboard would look like before connecting an account.
 */

export const sampleDailyDigest: DailyDigest = {
  asOf: "2026-08-07",
  portfolioSummary:
    "Your portfolio is up modestly this week, led by your core index fund. Your one individual stock, BEPC, is still below your $40 exit target, so no action is needed there yet.",
  hasBrokerageConnection: true,
  totalValue: 18420.55,
  overallGainLossPct: 6.8,
  cashAvailable: 1000.05,
  holdings: [
    {
      ticker: "VOO",
      shares: 22,
      marketValue: 12980.4,
      costBasis: 11750.0,
      gainLossPct: 10.5,
      exitRuleStatus: null,
      riskRating: "Low",
      riskReason:
        "A fund that owns all 500 companies in the S&P 500, so no single company's bad news can sink it. Low volatility and a long track record.",
      rating: "Buy",
      ratingReason:
        "Broad analyst consensus treats S&P 500 index exposure as a core long-term holding, and it's compounding steadily with no rule attached.",
      taxNote: null,
    },
    {
      ticker: "BEPC",
      shares: 95,
      marketValue: 3182.5,
      costBasis: 3040.0,
      gainLossPct: 4.7,
      exitRuleStatus: {
        status: "approaching",
        message:
          "Currently around $33.50 — about 16% below your $40 exit target. Not there yet, so your sell rule hasn't triggered.",
      },
      riskRating: "Medium",
      riskReason:
        "A renewable-energy company, so it's more sensitive to interest rates and clean-energy policy than a broad index fund, but it pays a steady dividend and has an investment-grade balance sheet.",
      rating: "Hold",
      ratingReason:
        "Analyst consensus is mixed-to-positive; still well below your $40 exit target, so there's no reason to act yet either direction.",
      taxNote:
        "You've held this over a year, so a sale today would qualify for the lower long-term capital gains tax rate instead of the higher short-term rate.",
    },
    {
      ticker: "SOFI",
      shares: 120,
      marketValue: 1257.6,
      costBasis: 1450.0,
      gainLossPct: -13.3,
      exitRuleStatus: null,
      riskRating: "High",
      riskReason:
        "A newer online bank without decades of history through a full economic cycle. Its stock price swings more than established banks, and profitability is still proving out.",
      rating: "Hold",
      ratingReason:
        "Street coverage is split on the growth-vs-profitability story; the position is inside its target band, so this is a watch, not a trade.",
      taxNote:
        "This position is currently at a loss. If you sell, avoid buying it back within 30 days — doing so would trigger the 'wash sale' rule and disallow the tax loss.",
    },
    {
      ticker: "Cash",
      shares: 1,
      marketValue: 1000.05,
      costBasis: 1000.05,
      gainLossPct: 0,
      exitRuleStatus: null,
      riskRating: "Low",
      riskReason: "Uninvested cash sitting in the brokerage account, earning a small amount of interest.",
      rating: "Hold",
      ratingReason: "Cash isn't a rated security — kept as Hold since there's no buy/sell decision to make on it.",
      taxNote: null,
    },
  ],
  watchlistItems: [
    {
      ticker: "SCHD",
      approxPrice: 27.4,
      summary:
        "A dividend-focused ETF holding roughly 100 established U.S. companies — you're tracking it as a possible addition, not holding it yet.",
      riskRating: "Low",
      riskReason: "Diversified across ~100 profitable, dividend-paying companies with long track records.",
      rating: "Buy",
      ratingReason: "Widely favored by dividend-focused analysts as a solid core addition.",
      sourceUrls: [],
    },
  ],
  dividendNotes: [
    "BEPC: next ex-dividend date is around Aug 28, 2026. A dividend is a small cash payment a company sends you just for owning its stock, usually every quarter.",
    "VOO: pays a small quarterly dividend automatically from the underlying companies in the fund; no action needed.",
  ],
  bottomLine:
    "Nothing needs your attention today. Your index fund is doing the steady, boring work it's supposed to, and BEPC hasn't reached your exit price. This is sample data — sign up and connect your own account to see this built from your real holdings.",
  sourceUrls: [],
};

export const sampleWeeklyTrends: WeeklyTrends = {
  asOf: "2026-08-03",
  hasBrokerageConnection: true,
  allocationCheck: {
    targetCoreEtfPct: 60,
    targetGrowthPct: 30,
    targetSpeculativePct: 10,
    actualCoreEtfPct: 70,
    actualGrowthPct: 17,
    actualSpeculativePct: 13,
    summary:
      "You're overweight core index funds relative to your own target (70% vs. your 60% goal) and underweight individual growth stocks (17% vs. 30%). That's a conservative-leaning drift, not an emergency — but worth knowing if you'd meant to add more growth exposure this year.",
  },
  marketTrends: [
    {
      title: "Utility and renewable-energy stocks catching a bid",
      summary:
        "Several large investors have been rotating into steady, dividend-paying utility and renewable names as a place to park money while interest-rate expectations stay uncertain. This is a sector-wide pattern, not a story about any one company.",
      sourceUrls: [],
    },
    {
      title: "Broad market near record highs, but narrowly led",
      summary:
        "Major indexes like the S&P 500 are near all-time highs, but the gains are concentrated in a small number of very large technology companies. A broad index fund like VOO still benefits, just less evenly than it might look at first glance.",
      sourceUrls: [],
    },
  ],
  newIdeas: [
    {
      ticker: "SCHD",
      approxPrice: 27.4,
      whatItDoes:
        "An ETF (a basket of many stocks bundled into one) that holds roughly 100 U.S. companies with a long history of paying and growing their dividends.",
      whyNow:
        "It would add dividend-focused, lower-volatility exposure without concentrating risk in any single company — a natural complement to a core index fund.",
      riskRating: "Low",
      riskReason:
        "Diversified across ~100 established, profitable companies with long dividend histories. Moves less than the broad market in downturns, historically.",
      rating: "Buy",
      ratingReason:
        "Widely favored by dividend-focused analysts as a core holding; would round out this portfolio's income exposure without adding single-stock risk.",
      bucket: "CORE_ETF",
      horizon: "long-term",
      sourceUrls: [],
    },
    {
      ticker: "CELH",
      approxPrice: 38.2,
      whatItDoes: "Makes energy drinks and functional beverages, competing with much larger established brands.",
      whyNow:
        "Recent distribution deals have expanded shelf space significantly, and the stock has pulled back from its highs, which sometimes creates a more reasonable entry price.",
      riskRating: "High",
      riskReason:
        "Smaller company in a competitive category dominated by giants; results can swing sharply on a single earnings report. Best sized small if used at all.",
      rating: "Hold",
      ratingReason:
        "Analyst opinion is divided post-pullback — worth watching for a clearer trend before treating it as a buy.",
      bucket: "SPECULATIVE",
      horizon: "short-term",
      sourceUrls: [],
    },
  ],
  watchlistItems: [
    {
      ticker: "SCHD",
      approxPrice: 27.4,
      summary:
        "A dividend-focused ETF holding roughly 100 established U.S. companies — you're tracking it as a possible addition, not holding it yet.",
      riskRating: "Low",
      riskReason: "Diversified across ~100 profitable, dividend-paying companies with long track records.",
      rating: "Buy",
      ratingReason: "Widely favored by dividend-focused analysts as a solid core addition.",
      sourceUrls: [],
    },
  ],
  connectionsToExistingHoldings: [
    "SCHD would overlap somewhat with VOO's largest holdings, so it wouldn't be pure diversification — more of a tilt toward dividend payers within the same large-cap universe you already own.",
  ],
};

export const sampleBreakingNews: BreakingNews = {
  asOf: "2026-08-06T14:00:00Z",
  hasMaterialEvents: true,
  alerts: [
    {
      ticker: "BEPC",
      headline: "Brookfield Renewable announces new solar project pipeline",
      whatHappened:
        "The company announced roughly 500 megawatts of new solar and storage projects moving into construction over the next two years, funded largely through existing cash flow rather than new debt.",
      whyItMatters:
        "More projects under construction generally means more future cash flow, but it doesn't change your exit rule — the stock is still well below your $40 target, so this is informational, not actionable.",
      riskRating: "Medium",
      sourceUrls: [],
      publishedAt: "2026-08-06T13:10:00Z",
    },
  ],
};
