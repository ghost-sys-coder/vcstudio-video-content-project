import "server-only";
import { ElevenLabsUnavailableError } from "./errors";
import {
  elevenLabsEnvironmentSchema,
  elevenLabsUnavailableReason,
} from "./environment";

export function getElevenLabsEnvironment() {
  // Read on each operation, so a provider instance cannot bypass a disabled
  // service after configuration changes. Never export the key to browser views.
  return elevenLabsEnvironmentSchema.parse(process.env);
}
export { ElevenLabsUnavailableError } from "./errors";
export function requireElevenLabs(visual = false) {
  const env = getElevenLabsEnvironment();
  const reason = elevenLabsUnavailableReason(env, visual);
  if (reason) throw new ElevenLabsUnavailableError(reason);
  return env;
}
export function elevenLabsStatus() {
  const env = getElevenLabsEnvironment();
  return {
    enabled: !elevenLabsUnavailableReason(env),
    usageMode: env.ELEVENLABS_USAGE_MODE,
    voice: {
      available: !elevenLabsUnavailableReason(env),
      reason: elevenLabsUnavailableReason(env),
      model: env.ELEVENLABS_TTS_MODEL,
    },
    image: {
      available:
        !elevenLabsUnavailableReason(env, true) &&
        env.ELEVENLABS_IMAGE_PRICING_JSON.length === 9,
      reason:
        elevenLabsUnavailableReason(env, true) ??
        (env.ELEVENLABS_IMAGE_PRICING_JSON.length !== 9
          ? "Configure all nine conservative image prices before enabling image generation."
          : null),
    },
    video: {
      available: !elevenLabsUnavailableReason(env, true),
      reason: elevenLabsUnavailableReason(env, true),
    },
  };
}
