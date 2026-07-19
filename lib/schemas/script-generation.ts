import { z } from "zod";

/** Structured output for AI script generation (drives `zodTextFormat`). */
export const scriptGenerationOutputSchema = z.object({
  // Plain narration text only — no scene directions or headings — so it can flow
  // straight into scene analysis.
  script: z.string().min(1),
  suggestedTitle: z.string().min(1).max(200),
});

export type ScriptGenerationOutput = z.infer<
  typeof scriptGenerationOutputSchema
>;
