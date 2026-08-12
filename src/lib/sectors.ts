/**
 * Static, free ticker -> sector map for allocation-by-sector breakdowns.
 * Covers common large-cap stocks and sector/broad-market ETFs; anything
 * not listed falls back to "Other" rather than guessing. No external API,
 * no cost, no rate limits.
 */
export const SECTOR_MAP: Record<string, string> = {
  // Broad-market / diversified ETFs
  VOO: "Diversified (ETF)",
  SPY: "Diversified (ETF)",
  IVV: "Diversified (ETF)",
  VTI: "Diversified (ETF)",
  QQQ: "Diversified (ETF)",
  QQQM: "Diversified (ETF)",
  DIA: "Diversified (ETF)",
  IWM: "Diversified (ETF)",
  VTV: "Diversified (ETF)",
  VUG: "Diversified (ETF)",
  VXUS: "Diversified (ETF)",
  VEA: "Diversified (ETF)",
  VWO: "Diversified (ETF)",
  SCHD: "Diversified (ETF)",
  SCHG: "Diversified (ETF)",
  SCHX: "Diversified (ETF)",
  VYM: "Diversified (ETF)",
  VIG: "Diversified (ETF)",
  ARKK: "Diversified (ETF)",

  // Bonds / cash-like
  BND: "Bonds",
  AGG: "Bonds",
  TLT: "Bonds",

  // Commodities
  GLD: "Commodities",
  SLV: "Commodities",

  // Sector ETFs
  XLK: "Technology",
  XLF: "Financials",
  XLE: "Energy",
  XLV: "Healthcare",
  XLY: "Consumer Discretionary",
  XLP: "Consumer Staples",
  XLI: "Industrials",
  XLB: "Materials",
  XLU: "Utilities",
  XLRE: "Real Estate",
  XLC: "Communication Services",
  SMH: "Technology",
  SOXX: "Technology",

  // Technology
  AAPL: "Technology",
  MSFT: "Technology",
  NVDA: "Technology",
  AVGO: "Technology",
  ORCL: "Technology",
  CRM: "Technology",
  ADBE: "Technology",
  AMD: "Technology",
  INTC: "Technology",
  QCOM: "Technology",
  TXN: "Technology",
  IBM: "Technology",
  NOW: "Technology",
  INTU: "Technology",
  AMAT: "Technology",
  MU: "Technology",
  PANW: "Technology",
  CRWD: "Technology",
  SNOW: "Technology",
  PLTR: "Technology",
  SHOP: "Technology",
  UBER: "Technology",
  ABNB: "Technology",

  // Communication Services
  GOOGL: "Communication Services",
  GOOG: "Communication Services",
  META: "Communication Services",
  NFLX: "Communication Services",
  DIS: "Communication Services",
  CMCSA: "Communication Services",
  T: "Communication Services",
  VZ: "Communication Services",
  TMUS: "Communication Services",

  // Consumer Discretionary
  AMZN: "Consumer Discretionary",
  TSLA: "Consumer Discretionary",
  HD: "Consumer Discretionary",
  MCD: "Consumer Discretionary",
  NKE: "Consumer Discretionary",
  SBUX: "Consumer Discretionary",
  LOW: "Consumer Discretionary",
  BKNG: "Consumer Discretionary",
  TJX: "Consumer Discretionary",

  // Consumer Staples
  WMT: "Consumer Staples",
  PG: "Consumer Staples",
  KO: "Consumer Staples",
  PEP: "Consumer Staples",
  COST: "Consumer Staples",
  PM: "Consumer Staples",
  MDLZ: "Consumer Staples",

  // Financials
  JPM: "Financials",
  V: "Financials",
  MA: "Financials",
  BAC: "Financials",
  WFC: "Financials",
  GS: "Financials",
  MS: "Financials",
  AXP: "Financials",
  SCHW: "Financials",
  BLK: "Financials",
  SOFI: "Financials",
  COIN: "Financials",

  // Healthcare
  LLY: "Healthcare",
  UNH: "Healthcare",
  JNJ: "Healthcare",
  ABBV: "Healthcare",
  MRK: "Healthcare",
  PFE: "Healthcare",
  TMO: "Healthcare",
  ABT: "Healthcare",
  DHR: "Healthcare",
  ISRG: "Healthcare",
  AMGN: "Healthcare",

  // Industrials
  GE: "Industrials",
  CAT: "Industrials",
  BA: "Industrials",
  HON: "Industrials",
  UPS: "Industrials",
  RTX: "Industrials",
  LMT: "Industrials",
  DE: "Industrials",

  // Energy
  XOM: "Energy",
  CVX: "Energy",
  COP: "Energy",
  SLB: "Energy",

  // Materials
  LIN: "Materials",
  FCX: "Materials",
  NEM: "Materials",

  // Real Estate
  PLD: "Real Estate",
  AMT: "Real Estate",
  O: "Real Estate",

  // Utilities
  NEE: "Utilities",
  DUK: "Utilities",
  SO: "Utilities",
};

export function getSector(ticker: string): string {
  return SECTOR_MAP[ticker.toUpperCase()] ?? "Other";
}
