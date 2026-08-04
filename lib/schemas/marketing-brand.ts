import { z } from "zod";
import {
  ONBOARDING_QUESTIONS,
  getOnboardingQuestion,
} from "@/lib/marketing/brand/onboarding-questions";

export const MAX_LIST_ITEMS = 20;
export const MAX_LIST_ITEM_LENGTH = 200;

/**
 * A newline-separated textarea into a bounded string array.
 *
 * Blank lines are dropped and each entry trimmed, so the stored array is what
 * the user meant rather than a record of how they used the Enter key.
 */
export const stringListSchema = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== ""),
  )
  .pipe(z.array(z.string().max(MAX_LIST_ITEM_LENGTH)).max(MAX_LIST_ITEMS));

export const saveOnboardingAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        questionKey: z.string().min(1),
        answerText: z.string(),
      }),
    )
    .min(1)
    .max(ONBOARDING_QUESTIONS.length)
    // An unknown key is rejected rather than ignored: the catalogue is the
    // contract, and silently dropping an answer would look like data loss.
    .superRefine((answers, ctx) => {
      const seen = new Set<string>();
      for (const [index, answer] of answers.entries()) {
        const question = getOnboardingQuestion(answer.questionKey);
        if (!question) {
          ctx.addIssue({
            code: "custom",
            path: [index, "questionKey"],
            message: `Unknown question: ${answer.questionKey}`,
          });
          continue;
        }
        if (answer.answerText.length > question.maxLength)
          ctx.addIssue({
            code: "custom",
            path: [index, "answerText"],
            message: `That answer is longer than the ${question.maxLength} character limit.`,
          });
        if (seen.has(answer.questionKey))
          ctx.addIssue({
            code: "custom",
            path: [index, "questionKey"],
            message: `Duplicate answer for ${answer.questionKey}`,
          });
        seen.add(answer.questionKey);
      }
    }),
});

export const brandProfileSchema = z.object({
  businessName: z.string().trim().max(120),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "A website must start with http:// or https://",
    ),
  oneLiner: z.string().trim().max(300),
  longDescription: z.string().trim().max(2000),
  industry: z.string().trim().max(160),
  primaryLanguage: z.string().trim().min(1).max(64),
  timezone: z.string().trim().min(1).max(64),
});

export const brandVoiceSchema = z.object({
  brandVoiceSummary: z.string().trim().max(1200),
  toneAttributes: stringListSchema,
  writingRules: stringListSchema,
  bannedPhrases: stringListSchema,
  valueProps: stringListSchema,
  proofPoints: stringListSchema,
  complianceNotes: z.string().trim().max(2000),
});

export const brandAudienceSchema = z.object({
  audienceId: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1200),
  painPoints: stringListSchema,
  geography: z.string().trim().max(200),
  buyingTriggers: stringListSchema,
  isPrimary: z.boolean(),
});

export const brandOfferSchema = z.object({
  offerId: z.uuid().optional(),
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().max(1200),
  priceModel: z.string().trim().max(160),
  audienceId: z.uuid().nullable(),
  differentiators: stringListSchema,
});

export const deleteBrandEntitySchema = z.object({ id: z.uuid() });

export type BrandProfileInput = z.infer<typeof brandProfileSchema>;
export type BrandVoiceInput = z.infer<typeof brandVoiceSchema>;
export type BrandAudienceInput = z.infer<typeof brandAudienceSchema>;
export type BrandOfferInput = z.infer<typeof brandOfferSchema>;

/** Checkboxes are absent from FormData when unticked; an empty select is null. */
export function readBrandAudienceForm(
  formData: FormData,
): Record<string, unknown> {
  return {
    ...(formData.get("audienceId")
      ? { audienceId: formData.get("audienceId") }
      : {}),
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    painPoints: formData.get("painPoints") ?? "",
    geography: formData.get("geography") ?? "",
    buyingTriggers: formData.get("buyingTriggers") ?? "",
    isPrimary: formData.get("isPrimary") === "on",
  };
}

export function readBrandOfferForm(
  formData: FormData,
): Record<string, unknown> {
  const audienceId = String(formData.get("audienceId") ?? "").trim();
  return {
    ...(formData.get("offerId") ? { offerId: formData.get("offerId") } : {}),
    name: formData.get("name") ?? "",
    summary: formData.get("summary") ?? "",
    priceModel: formData.get("priceModel") ?? "",
    audienceId: audienceId === "" ? null : audienceId,
    differentiators: formData.get("differentiators") ?? "",
  };
}
