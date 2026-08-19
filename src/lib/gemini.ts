import { GoogleGenAI } from "@google/genai";

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

/** Thin wrapper around client.models.generateContent that retries exactly
 * once, after a short delay, when Gemini fails with a transient overload
 * error rather than a real problem with the request itself -- so a report
 * doesn't silently fail for an entire scheduled run just because Gemini was
 * briefly overloaded at the exact moment this one call happened to fire. */
export async function generateGeminiContent(client: GoogleGenAI, params: GenerateContentParams) {
  try {
    return await client.models.generateContent(params);
  } catch (err) {
    if (!isTransientOverloadError(err)) throw err;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return await client.models.generateContent(params);
  }
}
