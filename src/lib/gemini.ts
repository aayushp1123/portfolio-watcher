import { GoogleGenAI } from "@google/genai";
import type { z } from "zod";
import { toJsonSchema } from "@/lib/reports/schemas";
import { isGroqConfigured, generateGroqJson, getGroqModel } from "@/lib/groq";

type GenerateContentParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

/** Gemini occasionally returns a transient 503 "high demand" UNAVAILABLE
 * error that has nothing to do with our own quota (a plain retry usually
 * succeeds within seconds) -- distinct from a 429/quota-exhaustion error,
 * which should NOT be retried since retrying that just wastes another call
 * against an already-exhausted daily budget. */
function isTransientOverloadError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /"code":503|"status":"UNAVAILABLE"|overloaded/i.test(message);
}

/**
 * Whether AI report generation is enabled. False whenever GEMINI_API_KEY
 * is unset — every code path that could make a network call must check
 * this first, before constructing a client.
 */
export function isAiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function getGeminiClient(): GoogleGenAI {
  if (!isAiConfigured()) {
    throw new Error("Gemini API key is not configured");
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-flash-latest";
}

// Gemini's free tier has had a genuinely rough demand-spike streak (observed
// live, repeatedly, on 2026-08-24) where a single 3-second retry wasn't
// always enough to clear it. Backing off longer and retrying a couple more
// times costs nothing but a little wall-clock time (well inside this
// function's 300s budget) and doesn't touch any external quota the way a
// Groq fallback does, so it's the more reliable backstop for a sustained
// spike rather than just a single blip.
const OVERLOAD_RETRY_DELAYS_MS = [3000, 6000, 12000];

// No call to Gemini should be able to eat the whole route's 300s budget by
// itself -- unlike every other external fetch in this codebase, this call
// had no timeout at all, so a single slow/hung response could silently run
// out the entire function and get killed by Vercel with a bare 504, instead
// of failing into the retry/Groq-fallback path below like a normal error
// would. A timeout here is NOT retried the way a 503 overload is -- retrying
// the exact same slow request is unlikely to suddenly get faster.
//
// Set generously (not tightly) on purpose: confirmed live on 2026-08-25 that
// Daily Digest/Weekly Trends' large real prompts (~10-11k tokens) can
// genuinely take Gemini longer than a short timeout to finish -- and Groq
// can't rescue either of those two report types anyway (its 8,000
// tokens/minute ceiling rejects a prompt that size outright, confirmed live
// the same day). A short timeout there only aborts a call that would have
// succeeded, with no usable fallback behind it. 200s leaves real margin
// under the 300s route budget for buildContext's own fetching plus a Groq
// attempt (which Breaking News's much smaller prompt can actually use).
const GEMINI_CALL_TIMEOUT_MS = 200000;

/** Thin wrapper around client.models.generateContent that retries after a
 * short, increasing delay when Gemini fails with a transient overload error
 * rather than a real problem with the request itself -- so a report doesn't
 * silently fail for an entire scheduled run just because Gemini was briefly
 * (or not so briefly) overloaded at the exact moment this call fired. */
export async function generateGeminiContent(client: GoogleGenAI, params: GenerateContentParams) {
  for (let attempt = 0; ; attempt++) {
    const startedAt = Date.now(); // temporary instrumentation -- pins down exactly how long the call ran before an abort, since raising the timeout from 60s to 200s changed nothing about the failure
    try {
      return await client.models.generateContent({
        ...params,
        config: { ...params.config, abortSignal: AbortSignal.timeout(GEMINI_CALL_TIMEOUT_MS) },
      });
    } catch (err) {
      console.error(`[gemini] call failed after ${Date.now() - startedAt}ms (attempt ${attempt}):`, err instanceof Error ? err.name : err);
      if (err instanceof Error && err.name === "TimeoutError") throw err;
      if (!isTransientOverloadError(err) || attempt >= OVERLOAD_RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, OVERLOAD_RETRY_DELAYS_MS[attempt]));
    }
  }
}

/**
 * Shared entry point every report generator (Daily Digest, Weekly Trends,
 * Breaking News) calls to get one AI-written, schema-validated report.
 * Gemini is always tried first, so report quality/structure/rules are
 * unchanged from normal operation -- Groq only steps in if Gemini fails
 * entirely (already-retried transient overload, quota exhaustion, or any
 * other error), using the exact same system prompt, user prompt, and Zod
 * schema, so a fallback report still follows every rule the primary engine
 * would have. No-ops back to a thrown error if GROQ_API_KEY isn't set,
 * same as before this fallback existed.
 */
export async function generateReportContent<T>({
  schema,
  systemPrompt,
  userMessage,
}: {
  schema: z.ZodType<T>;
  systemPrompt: string;
  userMessage: string;
}): Promise<{ report: T; model: string; inputTokens: number | null; outputTokens: number | null }> {
  try {
    const client = getGeminiClient();
    const model = getGeminiModel();
    const response = await generateGeminiContent(client, {
      model,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: toJsonSchema(schema),
        thinkingConfig: { thinkingBudget: -1 },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No text content in Gemini response");

    return {
      report: schema.parse(JSON.parse(text)),
      model,
      inputTokens: response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
    };
  } catch (err) {
    if (!isGroqConfigured()) throw err;
    console.error("Gemini report generation failed, falling back to Groq", err);

    const text = await generateGroqJson(systemPrompt, userMessage, toJsonSchema(schema));
    return {
      report: schema.parse(JSON.parse(text)),
      model: `groq:${getGroqModel()}`,
      inputTokens: null,
      outputTokens: null,
    };
  }
}
