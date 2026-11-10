import {
  elevenLabsEnvironmentSchema,
  elevenLabsUnavailableReason,
} from "@/lib/elevenlabs/environment";
import { z } from "zod";
import { videoModelPricingSchema } from "@studio/contracts/video";

const optionalKey = z.preprocess(
  (value) => (typeof value === "string" && !value.trim() ? undefined : value),
  z.string().trim().min(1).optional(),
);
export const videoEnvironmentSchema = z.object({
  ...elevenLabsEnvironmentSchema.shape,
  ENABLE_VIDEO_GENERATION: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  GOOGLE_AI_VIDEO_GENERATION_API_KEY: optionalKey,
  RUNWAYML_API_SECRET: optionalKey,
  LUMA_AGENTS_API_KEY: optionalKey,
  VIDEO_GENERATION_MAX_COST_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .max(10000)
    .default(150),
  VIDEO_GENERATION_DAILY_BUDGET_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .max(100000)
    .default(300),
  VIDEO_GENERATION_LIFETIME_BUDGET_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .max(1000000)
    .default(1500),
  VIDEO_GENERATION_PRICING_JSON: z.preprocess((value) => {
    if (value === undefined || value === "") return [];
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }, z.array(videoModelPricingSchema).max(40)),
});
export type VideoEnvironment = z.infer<typeof videoEnvironmentSchema>;
export function videoProviderConfigured(
  provider: string,
  environment: VideoEnvironment,
) {
  if (provider === "elevenlabs")
    return !elevenLabsUnavailableReason(environment, true);
  return provider === "google_gemini"
    ? Boolean(environment.GOOGLE_AI_VIDEO_GENERATION_API_KEY)
    : provider === "runway"
      ? Boolean(environment.RUNWAYML_API_SECRET)
      : provider === "luma"
        ? Boolean(environment.LUMA_AGENTS_API_KEY)
        : false;
}
