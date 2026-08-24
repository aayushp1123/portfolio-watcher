/**
 * Optional free-tier LLM engine via Groq's OpenAI-compatible chat API --
 * used as a pilot alternative for lower-stakes report generation (Breaking
 * News), with an automatic fallback to Gemini on any failure. No SDK
 * dependency; a plain fetch call, same pattern as the rest of this app's
 * free API clients (see quotes.ts). No-ops entirely if GROQ_API_KEY isn't
 * set -- Gemini remains the only required engine.
 */
export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

/** Sends a system+user prompt pair to Groq, constrained to the given JSON
 * Schema via Groq's strict structured-output mode (the same guarantee
 * Gemini's responseJsonSchema gives -- the model literally cannot omit a
 * required field or invent an extra one), and returns the raw JSON text
 * response. A plain "match this schema" instruction in the prompt text was
 * tried first and unreliably dropped required fields on larger schemas;
 * strict mode does not. Throws on any failure (network, non-2xx, missing
 * content) -- callers are expected to catch and fall back to Gemini. */
export async function generateGroqJson(
  systemPrompt: string,
  userMessage: string,
  jsonSchema: Record<string, unknown>
): Promise<string> {
  if (!isGroqConfigured()) {
    throw new Error("Groq API key is not configured");
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "report", schema: jsonSchema, strict: true },
      },
      // Groq's free "on_demand" tier caps this org at a hard 8000 tokens/min
      // TOTAL (prompt + completion) -- confirmed live against production
      // data (a real Daily Digest prompt already runs ~4000 tokens on its
      // own). This model spends most of its completion budget on internal
      // reasoning by default (measured 2364 of 3667 tokens on one real
      // report), leaving too little room for the actual JSON before hitting
      // that 8000 ceiling or running out of budget mid-document.
      // reasoning_effort: "low" cut that same real report's total usage
      // from 7761 to 6546 tokens with no loss in schema validity, which is
      // what actually makes this fit reliably -- max_completion_tokens is a
      // backstop, not the main fix.
      reasoning_effort: "low",
      max_completion_tokens: 4096,
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("No text content in Groq response");
  }
  return text;
}
