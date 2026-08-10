import Anthropic from "@anthropic-ai/sdk";

/**
 * Whether AI report generation is enabled. False whenever ANTHROPIC_API_KEY
 * is unset — every code path that could spend money must check this first,
 * before constructing a client or making any network call.
 */
export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getAnthropicClient(): Anthropic {
  if (!isAiConfigured()) {
    throw new Error("Anthropic API key is not configured");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
}
