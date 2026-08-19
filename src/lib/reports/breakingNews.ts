// ============================================================================
// IMPORTS
// ============================================================================
import { getGeminiClient, getGeminiModel, generateGeminiContent } from "@/lib/gemini"; // this brings in the Gemini client factory, the configured model name, and the retry-wrapped generation call
import { isGroqConfigured, generateGroqJson, getGroqModel } from "@/lib/groq"; // this brings in the optional Groq engine's config check, JSON call, and model name
import { prisma } from "@/lib/prisma"; // this brings in the shared database client used to read the prior report and save the finished one
import { buildUserContext, type SharedMarketContext } from "@/lib/reports/buildContext"; // this brings in the function that assembles all the real data for one user
import { breakingNewsSchema, toJsonSchema, type BreakingNews } from "@/lib/reports/schemas"; // this brings in the Zod schema, its JSON-Schema converter, and the inferred TypeScript type

// ============================================================================
// CONSTANTS — the fixed thresholds that decide what counts as a "breaking" event
// ============================================================================
const MOVE_THRESHOLD_PCT = 4; // this is the minimum absolute price move (%) since the last check that counts as a confirmed move
const FRESH_HEADLINE_HOURS = 30; // this is how far back a headline can be published and still count as "fresh"
const FIFTY_TWO_WEEK_PROXIMITY_PCT = 3; // this is how close (%) the live price must be to its 52-week high/low to count as "near" it

// ============================================================================
// SYSTEM PROMPT — the fixed instructions sent to the AI (Groq or Gemini) on every Breaking News call
// ============================================================================
// Same constraint as the other two report generators: this is one long literal string,
// so it can't have inline `//` comments without injecting that text into the real prompt.
// Here's what each paragraph below does, in the order it appears:
//  1. Persona/framing — a monitor with no live web search, so it must never fabricate an
//     event, date, price move, or fact; general reasoning is only for explaining WHY a
//     given real fact matters, never for inventing a new fact.
//  2. CONFIRMED PRICE MOVES — a real measured price change, already verified by the code.
//  3. FRESH REAL HEADLINES — real RSS headlines, already deduped against what was reported before.
//  4. FRESH SEC 8-K FILINGS — a real material-event filing, the most authoritative signal available.
//  5. 52-WEEK HIGH/LOW PROXIMITY — a real measured technical milestone.
//  6. MOVING-AVERAGE CROSSOVER — a real computed golden/death cross signal.
//  7. SOURCE EVENT KEY — every item above is shown with a bracketed [key: ...] tag; the model
//     must copy that exact key into each alert's sourceEventKey field so the caller can
//     deterministically re-attach the real ticker/source URL/publish date afterward, instead
//     of trusting the model's own copy-through of those values.
//  8. How to write an alert for a confirmed price move.
//  9. How to write an alert for a fresh material headline (and when to skip a non-material one).
// 10. How to write an alert for a fresh 8-K filing.
// 11. How to write an alert for a 52-week proximity event.
// 12. How to write an alert for a moving-average crossover event.
// 13. The "quiet run" case — empty inputs means hasMaterialEvents: false and an empty
//     alerts array, and that this is the expected normal outcome, not a failure.
// 14. Final instruction — return only the JSON, nothing else.
const SYSTEM_PROMPT = `You are a monitor for a user's investment holdings. You do NOT have live web search, so you cannot verify news events on your own — never fabricate a "breaking" headline, a specific date/time, a price move, or any other specific fact you weren't explicitly given below. Every alert must be built entirely from the real, verified data sections given to you (confirmed price moves, real RSS headlines, real SEC filings, real 52-week proximity) — never from outside knowledge or memory of past events. The only place general reasoning belongs is whyItMatters, where you're expected to explain the real-world significance of a real, given fact (e.g. why an 8-K matters, why a move of this size is notable for this holding's risk profile) — reasoning about a real fact is fine, inventing a new fact is not.

CONFIRMED PRICE MOVES: A real, measured price change since the last check, computed from live market data — not something you need to verify.

FRESH REAL HEADLINES: Genuine, recently-published headlines (with publisher, date, and real link) pulled from live RSS feeds for these exact holdings, filtered to ones you haven't already reported before — also not something you need to verify.

FRESH SEC 8-K FILINGS: A company filing an 8-K with the SEC is, by definition, disclosing a material event — this is the most authoritative signal available, official and genuine, filtered to ones not already reported.

52-WEEK HIGH/LOW PROXIMITY: A real, measured signal that a holding's live price is now within a few percent of its 52-week high or low — a genuine technical milestone, not something you need to verify.

MOVING-AVERAGE CROSSOVER: A real, computed signal that a holding's 50-day moving average has just crossed its 200-day moving average (a "golden cross" when 50-day crosses above, historically read as bullish; a "death cross" when it crosses below, historically read as bearish) — real math on real daily closes, not something you need to verify.

SOURCE EVENT KEY (required for every alert): Every item in the five sections above is shown with a bracketed tag like [key: MOVE:AAPL] or [key: HEADLINE:https://...] at the start of its line. When you write an alert built from that item, copy its exact key into the alert's sourceEventKey field — this lets the real ticker, source link, and publish date get attached automatically and correctly. Copy it exactly; never invent a key that wasn't shown, and never reuse one key across two different alerts.

For each confirmed move, write one alert: headline states the ticker and the real % move, whatHappened restates the real numbers (do not invent additional facts like an earnings cause unless a fresh headline or 8-K below actually confirms it), whyItMatters gives grounded context for why a move of this size matters given the holding's risk profile.

For each fresh headline that's genuinely material (real business news — earnings, M&A, guidance, executive change, major regulatory action — not routine market commentary or opinion pieces), write one alert: headline is a plain-English restatement of the real headline, whatHappened summarizes only what the headline actually says, whyItMatters gives grounded context for this specific holding, sourceUrls includes the real link given, publishedAt is the real date given. Skip headlines that are just generic commentary/opinion with no real news content.

For each fresh 8-K filing, write one alert: headline notes the ticker filed a material event disclosure with the SEC, whatHappened says an 8-K was filed on the given date (you don't know the specific content unless a headline below also covers it — say so honestly rather than guessing what it's about), whyItMatters explains what an 8-K filing means in plain English and why the user should look at it, sourceUrls includes the real filing link given.

For each 52-week high/low proximity event, write one alert: headline states the ticker and that it's trading near its 52-week high or low with the real price and level given, whatHappened restates the real numbers, whyItMatters gives grounded context (near a high can mean strong momentum but also stretched valuation; near a low can mean a genuine buying opportunity or a warning sign, depending on whether anything else in this alert set explains why).

For each moving-average crossover event, write one alert: headline states the ticker and that it just formed a golden cross or death cross, whatHappened restates the real 50-day/200-day figures given, whyItMatters explains in plain English what a golden/death cross conventionally signals and notes it's one technical signal among many, not a standalone buy/sell trigger.

If all four lists are empty, or the only items are non-material commentary, set hasMaterialEvents to false and return an empty alerts array — that is the correct, expected behavior on most runs, not a failure state.

Return ONLY the structured JSON matching the provided schema — no other text.`;

// ============================================================================
// FUNCTION: buildUserMessage — turns the already-detected real events into the actual prompt text sent to the AI
// ============================================================================
// Unlike Daily Digest/Weekly Trends, this file's buildUserMessage doesn't read straight
// from context — it's handed the already-filtered, already-deduped event lists computed
// deterministically in generateBreakingNews below, so the model only ever sees events
// that already passed every real detection/dedup check. Every event also carries a real
// stable `key`, shown in the prompt so the model can echo it back via sourceEventKey.
function buildUserMessage(
  context: Awaited<ReturnType<typeof buildUserContext>>, // this is the user's full real-data context, used here only for the holdings ticker list
  confirmedMoves: Array<{ ticker: string; price: number; priorPrice: number; pctChange: number; key: string }>, // this is the list of holdings that moved enough since the last check
  freshHeadlines: Array<{ ticker: string; title: string; source: string; pubDate: string; link: string; key: string }>, // this is the list of new, not-yet-reported real headlines
  freshFilings: Array<{ ticker: string; description: string; filedAt: string; url: string; key: string }>, // this is the list of new, not-yet-reported real 8-K filings
  nearFiftyTwoWeek: Array<{ ticker: string; direction: "high" | "low"; price: number; level: number; pct: number; key: string }>, // this is the list of holdings newly close to their 52-week high/low
  maCrossovers: Array<{ ticker: string; type: "golden_cross" | "death_cross"; sma50: number; sma200: number; key: string }> // this is the list of holdings that just formed a golden/death cross
): string { // this defines the function that renders the detected events into the final prompt string
  const tickers = context.holdings.map((h) => h.ticker).join(", ") || "(no holdings connected yet)"; // this lists every ticker being watched, for context at the top of the prompt

  const movesText =
    confirmedMoves.length > 0
      ? confirmedMoves
          .map(
            (m) =>
              `- [key: ${m.key}] ${m.ticker}: ${m.pctChange >= 0 ? "+" : ""}${m.pctChange.toFixed(1)}% (from $${m.priorPrice.toFixed(2)} to $${m.price.toFixed(2)})` // this formats one confirmed price move as a single text line, tagged with its real event key
          )
          .join("\n") // this joins every confirmed move into one multi-line block
      : "(none — no holding has moved enough since the last check)"; // this explains why the section is empty, rather than just showing nothing

  const headlinesText =
    freshHeadlines.length > 0
      ? freshHeadlines
          .map(
            (h) =>
              `- [key: ${h.key}] [${h.ticker}] "${h.title}" — ${h.source}, ${new Date(h.pubDate).toLocaleString()} — ${h.link}` // this formats one fresh headline as a single text line, tagged with its real event key and including its real source link
          )
          .join("\n") // this joins every fresh headline into one multi-line block
      : "(none — no fresh unreported headlines for these holdings)"; // this explains why the section is empty, rather than just showing nothing

  const filingsText =
    freshFilings.length > 0
      ? freshFilings.map((f) => `- [key: ${f.key}] [${f.ticker}] ${f.description}, filed ${f.filedAt} — ${f.url}`).join("\n") // this formats every fresh 8-K filing as a single text line, tagged with its real event key and including its real filing link
      : "(none — no fresh unreported SEC filings for these holdings)"; // this explains why the section is empty, rather than just showing nothing

  const fiftyTwoWeekText =
    nearFiftyTwoWeek.length > 0
      ? nearFiftyTwoWeek
          .map(
            (n) =>
              `- [key: ${n.key}] ${n.ticker}: now $${n.price.toFixed(2)}, within ${n.pct.toFixed(1)}% of its 52-week ${n.direction} ($${n.level.toFixed(2)})` // this formats one 52-week proximity event as a single text line, tagged with its real event key
          )
          .join("\n") // this joins every proximity event into one multi-line block
      : "(none — no holding is newly near its 52-week high/low)"; // this explains why the section is empty, rather than just showing nothing

  const maCrossoverText =
    maCrossovers.length > 0
      ? maCrossovers
          .map(
            (c) =>
              `- [key: ${c.key}] ${c.ticker}: ${c.type === "golden_cross" ? "golden cross" : "death cross"} (50-day MA $${c.sma50.toFixed(2)}, 200-day MA $${c.sma200.toFixed(2)})` // this formats one moving-average crossover event as a single text line, tagged with its real event key
          )
          .join("\n") // this joins every crossover event into one multi-line block
      : "(none — no holding has newly formed a golden or death cross)"; // this explains why the section is empty, rather than just showing nothing

  // The return below is the literal prompt text handed to the AI as the user message — same
  // constraint as SYSTEM_PROMPT above, no inline comments possible inside it. Each section
  // header corresponds to one of the variables built above it: CONFIRMED PRICE MOVES ←
  // movesText, FRESH REAL HEADLINES ← headlinesText, FRESH SEC 8-K FILINGS ← filingsText,
  // 52-WEEK HIGH/LOW PROXIMITY ← fiftyTwoWeekText, MOVING-AVERAGE CROSSOVERS ← maCrossoverText.
  return `Current UTC time: ${new Date().toISOString()}

HOLDINGS TO WATCH: ${tickers}

CONFIRMED PRICE MOVES SINCE LAST CHECK:
${movesText}

FRESH REAL HEADLINES SINCE LAST CHECK (within ~${FRESH_HEADLINE_HOURS}h, not previously reported):
${headlinesText}

FRESH SEC 8-K FILINGS SINCE LAST CHECK (not previously reported):
${filingsText}

52-WEEK HIGH/LOW PROXIMITY (newly within ${FIFTY_TWO_WEEK_PROXIMITY_PCT}%, not previously reported this month):
${fiftyTwoWeekText}

MOVING-AVERAGE CROSSOVERS (newly formed, not previously reported this month):
${maCrossoverText}

Return the structured JSON per the schema and system instructions.`;
}

// ============================================================================
// FUNCTION: generateBreakingNewsContent — calls Groq first (if configured), falls back to Gemini
// ============================================================================
/** Pilot: Breaking News tries Groq first (free tier, much higher headroom
 * than Gemini's shared 20-req/day quota) and falls back to Gemini on any
 * failure -- network error, non-2xx, or output that fails the same Zod
 * schema Gemini's output is validated against. Gemini remains the only
 * required engine; this is purely additive. */
async function generateBreakingNewsContent(
  userMessage: string // this is the already-built prompt text containing every detected real event
): Promise<{ report: BreakingNews; model: string; inputTokens: number | null; outputTokens: number | null }> { // this defines the function that actually calls an AI engine and returns a validated report
  if (isGroqConfigured()) { // this checks whether a real Groq API key is set at all
    try {
      const text = await generateGroqJson(
        `${SYSTEM_PROMPT}\n\nReturn ONLY a single JSON object matching this schema: ${JSON.stringify(toJsonSchema(breakingNewsSchema))}`, // this appends the JSON schema to the system prompt since Groq's plain chat API has no dedicated schema parameter like Gemini's
        userMessage // this is the same real-event prompt text Gemini would also receive
      );
      const parsed = breakingNewsSchema.safeParse(JSON.parse(text)); // this validates Groq's raw JSON output against the real schema without throwing on failure
      if (parsed.success) { // this checks whether Groq's output actually matched the schema
        return { report: parsed.data, model: `groq:${getGroqModel()}`, inputTokens: null, outputTokens: null }; // this returns the Groq-generated report, tagging which exact model produced it (Groq doesn't report token usage the same way, so those are left null)
      }
      console.error("Groq breaking-news output failed schema validation, falling back to Gemini", parsed.error); // this logs the schema mismatch before falling through to Gemini
    } catch (err) {
      console.error("Groq breaking-news generation failed, falling back to Gemini", err); // this logs any network/API failure before falling through to Gemini
    }
  }

  const client = getGeminiClient(); // this creates the Gemini API client, used either as the only engine or as the fallback
  const geminiModel = getGeminiModel(); // this reads the configured Gemini model name

  const response = await generateGeminiContent(client, { // this makes the actual call to Gemini, retrying once if it's a transient overload error
    model: geminiModel, // this is which Gemini model to use
    contents: [{ role: "user", parts: [{ text: userMessage }] }], // this is the same real-event prompt text, sent as the user turn
    config: {
      systemInstruction: SYSTEM_PROMPT, // this is the fixed instructions defined above, sent as the system turn
      responseMimeType: "application/json", // this tells Gemini to return raw JSON
      responseJsonSchema: toJsonSchema(breakingNewsSchema), // this tells Gemini the exact JSON shape it must return
      thinkingConfig: { thinkingBudget: -1 }, // this lets Gemini use its own default/unlimited internal reasoning budget
    },
  });

  const text = response.text; // this pulls the raw JSON text out of Gemini's response
  if (!text) { // this checks whether Gemini actually returned any text
    throw new Error("No text content in Gemini response"); // this fails loudly rather than silently producing an empty report
  }

  return {
    report: breakingNewsSchema.parse(JSON.parse(text)), // this parses and validates Gemini's output against the real schema, throwing if it doesn't match
    model: geminiModel, // this records which Gemini model actually produced the report
    inputTokens: response.usageMetadata?.promptTokenCount ?? null, // this records the real prompt token count for cost/usage tracking
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? null, // this records the real output token count for cost/usage tracking
  };
}

// ============================================================================
// FUNCTION: generateBreakingNews — the entry point one cron/manual call uses to detect and report events for one user
// ============================================================================
export async function generateBreakingNews(
  userId: string,
  shared?: SharedMarketContext
): Promise<{ skipped: true; reason: string } | { skipped: false; report: BreakingNews }> { // this defines the function runBatch.ts calls once per user for this report kind
  const context = await buildUserContext(userId, shared); // this assembles all of this user's real data, reusing shared batch-wide market data if given

  if (context.holdings.length === 0) { // this checks whether the user has any real owned holdings at all — Breaking News only watches actual positions, not the watchlist
    return { skipped: true, reason: "No holdings connected yet — nothing to watch." }; // this skips generation entirely rather than asking the AI to watch nothing
  }

  // Deterministic move + headline detection: compare today's live prices and
  // real RSS headlines to what was saved with the last report, rather than
  // asking the model to guess whether something "happened."
  const priorReport = await prisma.report.findFirst({
    where: { userId, type: "BREAKING_NEWS" }, // this looks for this user's most recent prior Breaking News report
    orderBy: { generatedAt: "desc" }, // this sorts so the very latest one comes first
  });
  let priorSnapshot: Record<string, number> = {}; // this will hold the last-seen price for every ticker, read from the prior report
  let priorReportedLinks: string[] = []; // this will hold every headline/filing link (and synthetic dedup key) already surfaced before
  if (priorReport) { // this only runs when there actually is a prior report to read
    try {
      const parsed = JSON.parse(priorReport.content) as {
        priceSnapshot?: Record<string, number>; // this is the shape of the extra bookkeeping data stashed alongside the actual report content
        reportedLinks?: string[];
      };
      priorSnapshot = parsed.priceSnapshot ?? {}; // this recovers the prior price snapshot, or an empty object if it wasn't there
      priorReportedLinks = parsed.reportedLinks ?? []; // this recovers the prior reported-links list, or an empty array if it wasn't there
    } catch {
      priorSnapshot = {}; // this resets to a clean empty state if the prior report's stored content couldn't be parsed at all
    }
  }
  const priorReportedLinkSet = new Set(priorReportedLinks); // this turns the prior links array into a Set for fast membership checks below

  const confirmedMoves: Array<{ ticker: string; price: number; priorPrice: number; pctChange: number; key: string }> = []; // this will collect every holding whose price moved enough since the last check
  const newSnapshot: Record<string, number> = {}; // this will become this run's price snapshot, saved for the next check to compare against

  for (const h of context.holdings) { // this walks every real holding to check for a confirmed price move
    if (!h.livePrice) continue; // this skips a holding with no live price available at all — nothing to compare
    newSnapshot[h.ticker] = h.livePrice.price; // this records today's price regardless of whether a move is confirmed, so next run always has a baseline
    const prior = priorSnapshot[h.ticker]; // this looks up this ticker's price from the last check
    if (prior == null || prior === 0) continue; // this skips tickers with no valid prior price to compare against (first time seeing this ticker, or a zero baseline)
    const pctChange = ((h.livePrice.price - prior) / prior) * 100; // this computes the real % change since the last check
    if (Math.abs(pctChange) >= MOVE_THRESHOLD_PCT) { // this checks whether the move is big enough to count as "confirmed"
      confirmedMoves.push({ ticker: h.ticker, price: h.livePrice.price, priorPrice: prior, pctChange, key: `MOVE:${h.ticker}` }); // this records the confirmed move for the prompt, tagged with a stable per-ticker event key
    }
  }

  const holdingTickers = new Set(context.holdings.map((h) => h.ticker)); // this is the set of tickers actually being watched, used to filter headlines below
  const freshCutoff = Date.now() - FRESH_HEADLINE_HOURS * 3600 * 1000; // this is the real timestamp before which a headline no longer counts as "fresh"
  const freshHeadlines = context.recentHeadlines
    .filter((a) => a.relatedTicker && holdingTickers.has(a.relatedTicker)) // this keeps only headlines tied to a ticker the user actually holds
    .filter((a) => !priorReportedLinkSet.has(a.link)) // this drops any headline already surfaced in a previous run
    .filter((a) => new Date(a.pubDate).getTime() >= freshCutoff) // this drops any headline published before the freshness cutoff
    .map((a) => ({
      ticker: a.relatedTicker as string, // this is safe since the filter above already guarantees relatedTicker is set
      title: a.title, // this is the real headline title
      source: a.source, // this is the real publisher name
      pubDate: a.pubDate, // this is the real publish date
      link: a.link, // this is the real source URL, also used as the dedup key for future runs
      key: `HEADLINE:${a.link}`, // this is the stable event key shown in the prompt and echoed back via sourceEventKey
    }));

  const filingCutoffDate = new Date(freshCutoff).toISOString().slice(0, 10); // this is the freshness cutoff expressed as a plain date string, to compare against filedAt
  const freshFilings = context.materialFilings
    .filter((f) => f.formType === "8-K") // this keeps only material-event filings, not 10-Q/10-K routine reports
    .filter((f) => !priorReportedLinkSet.has(f.url)) // this drops any filing already surfaced in a previous run
    .filter((f) => f.filedAt >= filingCutoffDate) // this drops any filing filed before the freshness cutoff
    .map((f) => ({ ticker: f.ticker, description: f.description, filedAt: f.filedAt, url: f.url, key: `FILING:${f.url}` })); // this carries the real filing fields through plus a stable event key

  // Dedup key includes the calendar month so a holding hovering near its
  // 52-week line doesn't re-trigger an alert on every single check.
  const monthBucket = new Date().toISOString().slice(0, 7); // this is the current year-month string, used to bucket 52-week/MA-cross dedup keys
  const nearFiftyTwoWeek: Array<{
    ticker: string;
    direction: "high" | "low";
    price: number;
    level: number;
    pct: number;
    key: string; // this is also the event key shown in the prompt and echoed back via sourceEventKey, reused as the monthly dedup key
  }> = []; // this will collect every holding newly close to its 52-week high or low
  for (const h of context.holdings) { // this walks every real holding to check for 52-week proximity
    if (!h.livePrice?.fiftyTwoWeekHigh || !h.livePrice?.fiftyTwoWeekLow) continue; // this skips a holding missing either real 52-week figure — both must be present to compute proximity to either
    const { price, fiftyTwoWeekHigh, fiftyTwoWeekLow } = h.livePrice; // this pulls out the three real numbers needed below
    const pctFromHigh = ((fiftyTwoWeekHigh - price) / fiftyTwoWeekHigh) * 100; // this computes how far (%) the live price is below its 52-week high
    const pctFromLow = ((price - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100; // this computes how far (%) the live price is above its 52-week low
    const highKey = `52wk-high:${h.ticker}:${monthBucket}`; // this is this ticker's dedup/event key for a near-high alert this month
    const lowKey = `52wk-low:${h.ticker}:${monthBucket}`; // this is this ticker's dedup/event key for a near-low alert this month
    if (pctFromHigh >= 0 && pctFromHigh <= FIFTY_TWO_WEEK_PROXIMITY_PCT && !priorReportedLinkSet.has(highKey)) { // this checks the price is at/below the high and within the proximity threshold, and hasn't already been reported this month
      nearFiftyTwoWeek.push({ ticker: h.ticker, direction: "high", price, level: fiftyTwoWeekHigh, pct: pctFromHigh, key: highKey }); // this records the near-high event
    }
    if (pctFromLow >= 0 && pctFromLow <= FIFTY_TWO_WEEK_PROXIMITY_PCT && !priorReportedLinkSet.has(lowKey)) { // this checks the price is at/above the low and within the proximity threshold, and hasn't already been reported this month
      nearFiftyTwoWeek.push({ ticker: h.ticker, direction: "low", price, level: fiftyTwoWeekLow, pct: pctFromLow, key: lowKey }); // this records the near-low event
    }
  }

  // Golden/death cross detection: computeTechnicalIndicators already only
  // flags "golden_cross"/"death_cross" when the 50/200-day relationship
  // flipped within the last 5 trading days, so no separate prior-state
  // comparison is needed here -- just dedup by month like the 52-week block.
  const maCrossovers: Array<{ ticker: string; type: "golden_cross" | "death_cross"; sma50: number; sma200: number; key: string }> = []; // this will collect every holding that just formed a golden or death cross
  for (const h of context.holdings) { // this walks every real holding to check for a fresh moving-average crossover
    const cross = h.technicalIndicators?.movingAverageCross; // this reads the real computed crossover state for this holding
    if (cross !== "golden_cross" && cross !== "death_cross") continue; // this skips holdings with no fresh crossover (including the standing "bullish"/"bearish" non-fresh states)
    const key = `ma-cross:${h.ticker}:${monthBucket}`; // this is this ticker's dedup/event key for a crossover alert this month
    if (priorReportedLinkSet.has(key)) continue; // this skips a crossover already reported this month
    const mas = h.technicalIndicators?.movingAverages; // this reads the real raw 50/200-day averages needed for the alert text
    if (!mas) continue; // this skips if the raw averages aren't available for some reason, even though the crossover signal is
    maCrossovers.push({ ticker: h.ticker, type: cross, sma50: mas.sma50, sma200: mas.sma200, key }); // this records the crossover event
  }

  const userMessage = buildUserMessage(context, confirmedMoves, freshHeadlines, freshFilings, nearFiftyTwoWeek, maCrossovers); // this builds the final prompt text from every real event detected above, each one tagged with its real event key

  const { report, model, inputTokens, outputTokens } = await generateBreakingNewsContent(userMessage); // this actually calls Groq (if configured) or Gemini to write the alerts

  // Deterministic, not model-trusted — hasMaterialEvents follows the real detected signals.
  report.hasMaterialEvents =
    confirmedMoves.length > 0 ||
    freshHeadlines.length > 0 ||
    freshFilings.length > 0 ||
    nearFiftyTwoWeek.length > 0 ||
    maCrossovers.length > 0; // this overwrites the model's own judgment with whether any real event was actually detected this run

  // Deterministic, not model-trusted — re-attach the real ticker/source URL/publish date for
  // every alert the model tied to a known event via sourceEventKey, instead of trusting the
  // model's own copy-through of numbers/links it was only given as prose. An alert whose key
  // doesn't match anything (shouldn't happen per the prompt) is left exactly as the model wrote it.
  const eventByKey = new Map<string, { ticker: string; sourceUrls: string[]; publishedAt: string | null }>(); // this maps every real event's key to the real values that should be attached to any alert citing it
  for (const m of confirmedMoves) eventByKey.set(m.key, { ticker: m.ticker, sourceUrls: [], publishedAt: null }); // a price move has no source link or publish date of its own
  for (const h of freshHeadlines) eventByKey.set(h.key, { ticker: h.ticker, sourceUrls: [h.link], publishedAt: h.pubDate }); // a headline's real link and publish date come straight from the RSS feed
  for (const f of freshFilings) eventByKey.set(f.key, { ticker: f.ticker, sourceUrls: [f.url], publishedAt: f.filedAt }); // a filing's real link and filed date come straight from SEC EDGAR
  for (const n of nearFiftyTwoWeek) eventByKey.set(n.key, { ticker: n.ticker, sourceUrls: [], publishedAt: null }); // a 52-week proximity event has no source link or publish date of its own
  for (const c of maCrossovers) eventByKey.set(c.key, { ticker: c.ticker, sourceUrls: [], publishedAt: null }); // a moving-average crossover event has no source link or publish date of its own

  for (const alert of report.alerts) { // this walks every alert the model wrote
    const event = alert.sourceEventKey ? eventByKey.get(alert.sourceEventKey) : undefined; // this looks up the real event the model claimed this alert is about
    if (event) { // this only overwrites when the claimed key actually matches a real detected event
      alert.ticker = event.ticker; // this replaces the model's ticker with the real one from the matched event
      alert.sourceUrls = event.sourceUrls; // this replaces the model's source URLs with the real one(s) from the matched event
      alert.publishedAt = event.publishedAt; // this replaces the model's publish date with the real one from the matched event
    }
  }

  // Track every fresh headline/filing/52-week/MA-cross event we surfaced this run
  // (whether or not the model judged it material) so it's never re-considered next check.
  const newReportedLinks = [
    ...priorReportedLinkSet, // this carries forward every link/key already known from before
    ...freshHeadlines.map((h) => h.link), // this adds every headline link surfaced this run
    ...freshFilings.map((f) => f.url), // this adds every filing link surfaced this run
    ...nearFiftyTwoWeek.map((n) => n.key), // this adds every 52-week dedup key surfaced this run
    ...maCrossovers.map((c) => c.key), // this adds every crossover dedup key surfaced this run
  ].slice(-200); // this caps the growing list to the most recent 200 entries so it never grows unbounded

  await prisma.report.create({ // this saves the finished report, plus the bookkeeping data needed for next run's dedup, to the database
    data: {
      userId, // this is which user the report belongs to
      type: "BREAKING_NEWS", // this is the report kind being saved
      schemaVersion: 1, // this is the schema version this report was generated under
      content: JSON.stringify({ ...report, priceSnapshot: newSnapshot, reportedLinks: newReportedLinks }), // this bundles the actual report together with the price snapshot and reported-links list the next run will read back
      hasMaterialEvents: report.hasMaterialEvents, // this is stored as its own column too, for fast filtering without parsing the JSON content
      model, // this is which AI engine actually generated it (Gemini or a specific Groq model)
      inputTokens, // this records the real prompt token count for cost/usage tracking, when the engine reports one
      outputTokens, // this records the real output token count for cost/usage tracking, when the engine reports one
    },
  });

  return { skipped: false, report }; // this hands the finished report back to the caller
}
