import { z } from "zod";

export const riskToneSchema = z.enum(["Low", "Medium", "High"]);

export const ratingSchema = z.enum(["Buy", "Hold", "Sell"]);

export const holdingSchema = z.object({
  ticker: z.string(),
  shares: z.number(),
  marketValue: z.number(),
  costBasis: z.number().nullable(),
  gainLossPct: z.number().nullable(),
  exitRuleStatus: z
    .object({
      status: z.enum(["ok", "approaching", "triggered", "none"]),
      message: z.string(),
    })
    .nullable(),
  riskRating: riskToneSchema,
  riskReason: z.string(),
  rating: ratingSchema,
  ratingReason: z.string(),
  taxNote: z.string().nullable(),
});

export const dailyDigestSchema = z.object({
  asOf: z.string(),
  portfolioSummary: z.string(),
  totalValue: z.number(),
  overallGainLossPct: z.number().nullable(),
  holdings: z.array(holdingSchema),
  dividendNotes: z.array(z.string()),
  bottomLine: z.string(),
  sourceUrls: z.array(z.string()),
});
export type DailyDigest = z.infer<typeof dailyDigestSchema>;

export const newIdeaSchema = z.object({
  ticker: z.string(),
  approxPrice: z.number().nullable(),
  whatItDoes: z.string(),
  whyNow: z.string(),
  riskRating: riskToneSchema,
  riskReason: z.string(),
  rating: ratingSchema,
  ratingReason: z.string(),
  bucket: z.enum(["CORE_ETF", "INDIVIDUAL_GROWTH", "SPECULATIVE"]),
  horizon: z.enum(["long-term", "short-term"]),
  sourceUrls: z.array(z.string()),
});

export const weeklyTrendsSchema = z.object({
  asOf: z.string(),
  allocationCheck: z.object({
    targetCoreEtfPct: z.number(),
    targetGrowthPct: z.number(),
    targetSpeculativePct: z.number(),
    actualCoreEtfPct: z.number(),
    actualGrowthPct: z.number(),
    actualSpeculativePct: z.number(),
    summary: z.string(),
  }),
  marketTrends: z.array(
    z.object({ title: z.string(), summary: z.string(), sourceUrls: z.array(z.string()) })
  ),
  newIdeas: z.array(newIdeaSchema),
  connectionsToExistingHoldings: z.array(z.string()),
});
export type WeeklyTrends = z.infer<typeof weeklyTrendsSchema>;

export const breakingAlertSchema = z.object({
  ticker: z.string().nullable(),
  headline: z.string(),
  whatHappened: z.string(),
  whyItMatters: z.string(),
  riskRating: riskToneSchema,
  sourceUrls: z.array(z.string()),
  publishedAt: z.string().nullable(),
});

export const breakingNewsSchema = z.object({
  asOf: z.string(),
  hasMaterialEvents: z.boolean(),
  alerts: z.array(breakingAlertSchema),
});
export type BreakingNews = z.infer<typeof breakingNewsSchema>;

/** Converts a Zod object schema to a plain JSON Schema for output_config.format. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
}
