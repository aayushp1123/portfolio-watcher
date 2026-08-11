import { GoogleGenAI } from "@google/genai";

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
