import { z } from "zod";

import { templateIds } from "@/lib/templates/types";

export const onboardingInputModeSchema = z.enum(["text", "voice"]);
export type OnboardingInputMode = z.infer<typeof onboardingInputModeSchema>;

export const businessTypeSchema = z.enum(["informative", "commerce_lite"]);
export const stylePresetSchema = z.enum(["ocean", "sunset", "mono"]);
export const sectionPreferenceSchema = z.enum(["hero", "catalog", "testimonials", "contact"]);

const optionalE164Phone = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().regex(/^\+\d{8,15}$/, "Formato esperado: +573001234567").optional()
);

export const businessBriefDraftSchema = z.object({
  business_name: z.string().min(2).max(80),
  business_type: businessTypeSchema,
  offer_summary: z.string().min(12).max(600),
  target_audience: z.string().min(3).max(180),
  tone: z.string().min(2).max(80),
  primary_cta: z.string().min(2).max(80).default("WhatsApp"),
  whatsapp_phone: optionalE164Phone,
  whatsapp_message: z.string().max(500).optional(),
  section_preferences: z.array(sectionPreferenceSchema).min(1).max(4),
  style_preset: stylePresetSchema
});

export type BusinessBriefDraft = z.infer<typeof businessBriefDraftSchema>;

export const refineResponseSchema = z.object({
  briefDraft: businessBriefDraftSchema,
  confidence: z.number().min(0).max(1),
  completenessScore: z.number().min(0).max(100),
  warnings: z.array(z.string()),
  provider: z.enum(["llm", "heuristic"]),
  recommendedTemplateIds: z.array(z.enum(templateIds)),
  recommendedTemplateId: z.enum(templateIds).nullable()
});

export type RefineResponse = z.infer<typeof refineResponseSchema>;
