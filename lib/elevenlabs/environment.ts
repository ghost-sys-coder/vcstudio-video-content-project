import { z } from "zod";

const flag = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");
export const elevenLabsEnvironmentSchema = z.object({
  ENABLE_ELEVENLABS: flag,
  ELEVEN_LABS_API_KEY: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().min(1).optional(),
  ),
  ELEVENLABS_USAGE_MODE: z.enum(["internal", "commercial"]).default("internal"),
  ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED: flag,
  // Explicit deployment assertion, shared by web and worker. Public launches
  // must change this along with ENABLE_PRIVATE_ACCESS; neither defaults open.
  ELEVENLABS_INTERNAL_DEPLOYMENT: flag,
  ENABLE_PRIVATE_ACCESS: z.enum(["true", "false"]).optional(),
  ELEVENLABS_VISUALS_ENABLED: flag,
  ELEVENLABS_TTS_MODEL: z
    .enum(["eleven_multilingual_v2", "eleven_v3", "eleven_flash_v2_5"])
    .default("eleven_multilingual_v2"),
  // Conservative credit valuation, not a claim of incremental cash billing.
  ELEVENLABS_TTS_COST_PER_MILLION_CHARACTERS_CENTS: z.coerce
    .number()
    .int()
    .positive()
    .max(1000000)
    .default(30000),
  ELEVENLABS_IMAGE_PRICING_JSON: z.preprocess(
    (v) => {
      if (!v) return [];
      if (typeof v !== "string") return v;
      try {
        return JSON.parse(v) as unknown;
      } catch {
        return null;
      }
    },
    z
      .array(
        z
          .object({
            quality: z.enum(["low", "medium", "high"]),
            size: z.enum(["1024x1024", "1024x1536", "1536x1024"]),
            reservedCostCents: z.number().int().positive().max(10000),
          })
          .strict(),
      )
      .max(9)
      .refine(
        (rows) =>
          new Set(rows.map((row) => `${row.quality}:${row.size}`)).size ===
          rows.length,
        "Each image quality/size price must be unique.",
      ),
  ),
  IMAGE_GENERATION_PROVIDER: z.enum(["openai", "elevenlabs"]).default("openai"),
});
export type ElevenLabsEnvironment = z.infer<typeof elevenLabsEnvironmentSchema>;

export function elevenLabsUnavailableReason(
  env: ElevenLabsEnvironment,
  visual = false,
): string | null {
  if (!env.ENABLE_ELEVENLABS)
    return "ElevenLabs is switched off on this deployment.";
  if (!env.ELEVEN_LABS_API_KEY)
    return "The ElevenLabs server key is not configured.";
  if (
    env.ELEVENLABS_USAGE_MODE === "internal" &&
    (!env.ELEVENLABS_INTERNAL_DEPLOYMENT ||
      env.ENABLE_PRIVATE_ACCESS === "false")
  )
    return "ElevenLabs is restricted to the private in-house deployment.";
  if (
    env.ELEVENLABS_USAGE_MODE === "commercial" &&
    !env.ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED
  )
    return "Commercial ElevenLabs service use requires an explicit licensing review.";
  if (visual && !env.ELEVENLABS_VISUALS_ENABLED)
    return "ElevenLabs image/video API access requires Pro or higher and configured pricing. Voice remains available.";
  return null;
}
