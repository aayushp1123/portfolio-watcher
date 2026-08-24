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
