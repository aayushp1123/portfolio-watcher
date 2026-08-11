/**
 * Static list of common US-listed stocks and ETFs for the ticker
 * autocomplete dropdown. Bundled with the app (no external API call,
 * no rate limits, no cost) -- covers the names people actually search
 * for; not an exhaustive listing of every security.
 */
export interface TickerEntry {
  symbol: string;
  name: string;
}

export const TICKERS: TickerEntry[] = [
  // Broad market / core ETFs
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { symbol: "IVV", name: "iShares Core S&P 500 ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust (Nasdaq-100)" },
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF" },
  { symbol: "VTV", name: "Vanguard Value ETF" },
  { symbol: "VUG", name: "Vanguard Growth ETF" },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF" },
  { symbol: "VEA", name: "Vanguard FTSE Developed Markets ETF" },
  { symbol: "VWO", name: "Vanguard FTSE Emerging Markets ETF" },
  { symbol: "SCHD", name: "Schwab US Dividend Equity ETF" },
  { symbol: "SCHG", name: "Schwab US Large-Cap Growth ETF" },
  { symbol: "SCHX", name: "Schwab US Large-Cap ETF" },
  { symbol: "VYM", name: "Vanguard High Dividend Yield ETF" },
  { symbol: "VIG", name: "Vanguard Dividend Appreciation ETF" },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF" },
  { symbol: "AGG", name: "iShares Core U.S. Aggregate Bond ETF" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF" },
  { symbol: "GLD", name: "SPDR Gold Shares" },
  { symbol: "SLV", name: "iShares Silver Trust" },
  { symbol: "ARKK", name: "ARK Innovation ETF" },
  { symbol: "XLK", name: "Technology Select Sector SPDR Fund" },
  { symbol: "XLF", name: "Financial Select Sector SPDR Fund" },
  { symbol: "XLE", name: "Energy Select Sector SPDR Fund" },
  { symbol: "XLV", name: "Health Care Select Sector SPDR Fund" },
  { symbol: "XLY", name: "Consumer Discretionary Select Sector SPDR Fund" },
  { symbol: "XLI", name: "Industrial Select Sector SPDR Fund" },
  { symbol: "XLP", name: "Consumer Staples Select Sector SPDR Fund" },
  { symbol: "XLU", name: "Utilities Select Sector SPDR Fund" },
  { symbol: "XLRE", name: "Real Estate Select Sector SPDR Fund" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF" },
  { symbol: "SOXX", name: "iShares Semiconductor ETF" },

  // Mega-cap tech
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)" },
  { symbol: "GOOG", name: "Alphabet Inc. (Class C)" },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
  { symbol: "META", name: "Meta Platforms, Inc." },
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "ORCL", name: "Oracle Corporation" },
  { symbol: "CRM", name: "Salesforce, Inc." },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "NFLX", name: "Netflix, Inc." },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc." },
  { symbol: "QCOM", name: "QUALCOMM Incorporated" },
  { symbol: "TXN", name: "Texas Instruments Incorporated" },
  { symbol: "IBM", name: "International Business Machines Corporation" },
  { symbol: "CSCO", name: "Cisco Systems, Inc." },
  { symbol: "NOW", name: "ServiceNow, Inc." },
  { symbol: "UBER", name: "Uber Technologies, Inc." },
  { symbol: "SHOP", name: "Shopify Inc." },
  { symbol: "SNOW", name: "Snowflake Inc." },
  { symbol: "PLTR", name: "Palantir Technologies Inc." },
  { symbol: "PANW", name: "Palo Alto Networks, Inc." },
  { symbol: "CRWD", name: "CrowdStrike Holdings, Inc." },
  { symbol: "MU", name: "Micron Technology, Inc." },
  { symbol: "ASML", name: "ASML Holding N.V." },
  { symbol: "TSM", name: "Taiwan Semiconductor Manufacturing Co." },
  { symbol: "SPOT", name: "Spotify Technology S.A." },
  { symbol: "ABNB", name: "Airbnb, Inc." },
  { symbol: "DASH", name: "DoorDash, Inc." },
  { symbol: "SQ", name: "Block, Inc." },
  { symbol: "PYPL", name: "PayPal Holdings, Inc." },
  { symbol: "COIN", name: "Coinbase Global, Inc." },

  // Financials
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc. (Class B)" },
  { symbol: "JPM", name: "JPMorgan Chase & Co." },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "MA", name: "Mastercard Incorporated" },
  { symbol: "BAC", name: "Bank of America Corporation" },
  { symbol: "WFC", name: "Wells Fargo & Company" },
  { symbol: "GS", name: "The Goldman Sachs Group, Inc." },
  { symbol: "MS", name: "Morgan Stanley" },
  { symbol: "SCHW", name: "The Charles Schwab Corporation" },
  { symbol: "AXP", name: "American Express Company" },
  { symbol: "C", name: "Citigroup Inc." },
  { symbol: "SOFI", name: "SoFi Technologies, Inc." },
  { symbol: "BLK", name: "BlackRock, Inc." },

  // Healthcare
  { symbol: "UNH", name: "UnitedHealth Group Incorporated" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "LLY", name: "Eli Lilly and Company" },
  { symbol: "PFE", name: "Pfizer Inc." },
  { symbol: "ABBV", name: "AbbVie Inc." },
  { symbol: "MRK", name: "Merck & Co., Inc." },
  { symbol: "TMO", name: "Thermo Fisher Scientific Inc." },
  { symbol: "ABT", name: "Abbott Laboratories" },
  { symbol: "DHR", name: "Danaher Corporation" },
  { symbol: "NVO", name: "Novo Nordisk A/S" },
  { symbol: "ISRG", name: "Intuitive Surgical, Inc." },

  // Consumer
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "COST", name: "Costco Wholesale Corporation" },
  { symbol: "PG", name: "Procter & Gamble Company" },
  { symbol: "KO", name: "The Coca-Cola Company" },
  { symbol: "PEP", name: "PepsiCo, Inc." },
  { symbol: "MCD", name: "McDonald's Corporation" },
  { symbol: "NKE", name: "NIKE, Inc." },
  { symbol: "SBUX", name: "Starbucks Corporation" },
  { symbol: "HD", name: "The Home Depot, Inc." },
  { symbol: "LOW", name: "Lowe's Companies, Inc." },
  { symbol: "TGT", name: "Target Corporation" },
  { symbol: "DIS", name: "The Walt Disney Company" },
  { symbol: "CMG", name: "Chipotle Mexican Grill, Inc." },
  { symbol: "LULU", name: "Lululemon Athletica Inc." },
  { symbol: "CELH", name: "Celsius Holdings, Inc." },

  // Industrial / energy / materials
  { symbol: "XOM", name: "Exxon Mobil Corporation" },
  { symbol: "CVX", name: "Chevron Corporation" },
  { symbol: "CAT", name: "Caterpillar Inc." },
  { symbol: "BA", name: "The Boeing Company" },
  { symbol: "GE", name: "GE Aerospace" },
  { symbol: "HON", name: "Honeywell International Inc." },
  { symbol: "UPS", name: "United Parcel Service, Inc." },
  { symbol: "LMT", name: "Lockheed Martin Corporation" },
  { symbol: "RTX", name: "RTX Corporation" },
  { symbol: "DE", name: "Deere & Company" },
  { symbol: "NEE", name: "NextEra Energy, Inc." },
  { symbol: "BEPC", name: "Brookfield Renewable Corporation" },
  { symbol: "BEP", name: "Brookfield Renewable Partners L.P." },
  { symbol: "ENPH", name: "Enphase Energy, Inc." },
  { symbol: "FSLR", name: "First Solar, Inc." },

  // Communications / media
  { symbol: "T", name: "AT&T Inc." },
  { symbol: "VZ", name: "Verizon Communications Inc." },
  { symbol: "CMCSA", name: "Comcast Corporation" },

  // Speculative / small-cap growth names commonly watched
  { symbol: "RIVN", name: "Rivian Automotive, Inc." },
  { symbol: "LCID", name: "Lucid Group, Inc." },
  { symbol: "NIO", name: "NIO Inc." },
  { symbol: "PLUG", name: "Plug Power Inc." },
  { symbol: "RIOT", name: "Riot Platforms, Inc." },
  { symbol: "MARA", name: "MARA Holdings, Inc." },
  { symbol: "GME", name: "GameStop Corp." },
  { symbol: "AMC", name: "AMC Entertainment Holdings, Inc." },
  { symbol: "RKLB", name: "Rocket Lab USA, Inc." },
  { symbol: "IONQ", name: "IonQ, Inc." },

  // Misc large caps
  { symbol: "PM", name: "Philip Morris International Inc." },
  { symbol: "ACN", name: "Accenture plc" },
  { symbol: "TMUS", name: "T-Mobile US, Inc." },
  { symbol: "INTU", name: "Intuit Inc." },
  { symbol: "AMAT", name: "Applied Materials, Inc." },
  { symbol: "BKNG", name: "Booking Holdings Inc." },
  { symbol: "ADP", name: "Automatic Data Processing, Inc." },
  { symbol: "MDT", name: "Medtronic plc" },
  { symbol: "GILD", name: "Gilead Sciences, Inc." },
  { symbol: "REGN", name: "Regeneron Pharmaceuticals, Inc." },
  { symbol: "VRTX", name: "Vertex Pharmaceuticals Incorporated" },
];

/** Case-insensitive match on symbol prefix or name substring; symbol matches rank first. */
export function searchTickers(query: string, limit = 15): TickerEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const symbolMatches: TickerEntry[] = [];
  const nameMatches: TickerEntry[] = [];

  for (const t of TICKERS) {
    if (t.symbol.startsWith(q)) {
      symbolMatches.push(t);
    } else if (t.name.toUpperCase().includes(q)) {
      nameMatches.push(t);
    }
    if (symbolMatches.length >= limit) break;
  }

  return [...symbolMatches, ...nameMatches].slice(0, limit);
}
