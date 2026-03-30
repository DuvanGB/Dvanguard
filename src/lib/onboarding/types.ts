import { z } from "zod";

import { normalizeWhatsappPhone, validateWhatsappPhone } from "@/lib/whatsapp";

export const onboardingInputModeSchema = z.enum(["text", "voice"]);
export type OnboardingInputMode = z.infer<typeof onboardingInputModeSchema>;

export const businessTypeSchema = z.enum(["informative", "commerce_lite"]);
export const missingBriefFieldSchema = z.enum([
  "offer_summary",
  "target_audience",
  "whatsapp_phone",
  "business_type"
]);

const optionalE164Phone = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = normalizeWhatsappPhone(value);
    return normalized.length ? normalized : undefined;
  },
  z
    .string()
    .refine((value) => validateWhatsappPhone(value), "Formato esperado: +573001234567")
    .optional()
);

export const businessBriefDraftSchema = z.object({
  business_name: z.string().min(2).max(80),
  business_type: businessTypeSchema,
  offer_summary: z.string().min(12).max(600),
  target_audience: z.string().min(3).max(180),
  tone: z.string().min(2).max(80),
  primary_cta: z.string().min(2).max(80).default("WhatsApp"),
  whatsapp_phone: optionalE164Phone,
  whatsapp_message: z.string().max(500).optional()
});

export type BusinessBriefDraft = z.infer<typeof businessBriefDraftSchema>;
export type MissingBriefField = z.infer<typeof missingBriefFieldSchema>;

export const heroSuggestionSchema = z.object({
  headline: z.string().min(6).max(120),
  subheadline: z.string().min(12).max(220),
  primary_cta: z.string().min(2).max(80),
  hero_direction: z.string().min(8).max(160)
});

export type HeroSuggestion = z.infer<typeof heroSuggestionSchema>;

export const refineResponseSchema = z.object({
  briefDraft: businessBriefDraftSchema,
  confidence: z.number().min(0).max(1),
  completenessScore: z.number().min(0).max(100),
  warnings: z.array(z.string()),
  provider: z.enum(["llm", "heuristic"]),
  followUpQuestion: z.string().max(240).nullable().optional(),
  missingFields: z.array(missingBriefFieldSchema).default([]),
  offerSummarySuggestion: z.string().min(12).max(600).nullable().optional(),
  offerSummaryConfidence: z.number().min(0).max(1).nullable().optional(),
  offerSummaryNeedsApproval: z.boolean().optional(),
  heroSuggestion: heroSuggestionSchema.nullable().optional(),
  heroConfidence: z.number().min(0).max(1).nullable().optional()
});

export type RefineResponse = z.infer<typeof refineResponseSchema>;
