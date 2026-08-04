import { z } from "zod";

export const MARKETING_DOCUMENT_KEY_FACT_COUNT = 8;
export const MARKETING_DOCUMENT_SUMMARY_MAX_CHARACTERS = 1_500;
export const MARKETING_DOCUMENT_KEY_FACT_MAX_CHARACTERS = 300;

export const marketingDocumentTypeSchema = z.enum([
  "brand_guidelines",
  "product_information",
  "pricing",
  "case_study",
  "policy",
  "marketing_material",
  "research",
  "other",
]);

/**
 * Structured output contract for the document summariser.
 *
 * Bounded on every axis. The summary and each fact are length-capped because
 * this text is later concatenated into a brand context snapshot with a token
 * budget, and one runaway summary must not be able to crowd out every other
 * document in the corpus.
 */
export const marketingDocumentSummaryOutputSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(1)
    .max(MARKETING_DOCUMENT_SUMMARY_MAX_CHARACTERS),
  keyFacts: z
    .array(
      z.string().trim().min(1).max(MARKETING_DOCUMENT_KEY_FACT_MAX_CHARACTERS),
    )
    .max(MARKETING_DOCUMENT_KEY_FACT_COUNT),
  documentType: marketingDocumentTypeSchema,
});

export type MarketingDocumentSummaryOutput = z.infer<
  typeof marketingDocumentSummaryOutputSchema
>;
export type MarketingDocumentType = z.infer<typeof marketingDocumentTypeSchema>;
