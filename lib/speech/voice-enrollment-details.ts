import { z } from "zod";

/**
 * What the enrolment dialog must ask for, as the configured provider defines
 * it. Shared by the route that reports it and the browser that obeys it, so
 * the consent sentence a speaker reads is always the one the provider checks.
 */
export const voiceEnrollmentDetailsSchema = z.object({
  provider: z.enum(["openai", "gemini"]),
  consentPhrase: z.string().min(1),
  sample: z.object({
    minimumSeconds: z.number().positive(),
    maximumSeconds: z.number().positive(),
  }),
  /**
   * `wav` when the provider accepts only uncompressed audio, so the browser
   * converts its recording first; `any` when the recorder's own format is fine.
   */
  recordingFormat: z.enum(["wav", "any"]),
});

export type VoiceEnrollmentDetails = z.infer<
  typeof voiceEnrollmentDetailsSchema
>;
