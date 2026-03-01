import { z } from "zod";

export const onboardingInputModeSchema = z.enum(["text", "voice"]);
export type OnboardingInputMode = z.infer<typeof onboardingInputModeSchema>;

export const businessTypeSchema = z.enum(["informative", "commerce_lite"]);
export const stylePresetSchema = z.enum(["ocean", "sunset", "mono"]);
export const sectionPreferenceSchema = z.enum(["hero", "catalog", "testimonials", "contact"]);

export const businessBriefDraftSchema = z.object({
  business_name: z.string().min(2).max(80),
  business_type: businessTypeSchema,
  offer_summary: z.string().min(12).max(600),
  target_audience: z.string().min(3).max(180),
  tone: z.string().min(2).max(80),
  primary_cta: z.string().min(2).max(80).default("WhatsApp"),
  section_preferences: z.array(sectionPreferenceSchema).min(1).max(4),
  style_preset: stylePresetSchema
});

export type BusinessBriefDraft = z.infer<typeof businessBriefDraftSchema>;

export const refineResponseSchema = z.object({
  briefDraft: businessBriefDraftSchema,
  confidence: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  provider: z.enum(["llm", "heuristic"])
});

export type RefineResponse = z.infer<typeof refineResponseSchema>;
