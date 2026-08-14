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

/** Sends a system+user prompt pair to Groq and returns the raw JSON text
 * response. Throws on any failure (network, non-2xx, missing content) --
 * callers are expected to catch and fall back to Gemini. */
export async function generateGroqJson(systemPrompt: string, userMessage: string): Promise<string> {
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
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(30000),
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
