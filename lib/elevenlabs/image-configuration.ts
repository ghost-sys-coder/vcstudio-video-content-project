import "server-only";
import type { SceneImageEnvironment } from "@/lib/env/server-schema";
import { getElevenLabsEnvironment } from "./configuration";
import { elevenLabsUnavailableReason } from "./environment";

/** Preserve each queued job's model; deployment changes only affect new jobs. */
export function resolveImageEnvironment(
  base: SceneImageEnvironment,
): SceneImageEnvironment {
  const env = getElevenLabsEnvironment();
  if (env.IMAGE_GENERATION_PROVIDER !== "elevenlabs") return base;
  const prices = env.ELEVENLABS_IMAGE_PRICING_JSON;
  const price = (quality: string, square: boolean) =>
    Math.max(
      1,
      ...prices
        .filter(
          (p) =>
            p.quality === quality &&
            (square ? p.size === "1024x1024" : p.size !== "1024x1024"),
        )
        .map((p) => p.reservedCostCents),
    );
  const complete = ["low", "medium", "high"].every((q) =>
    ["1024x1024", "1024x1536", "1536x1024"].every(
      (s) => prices.filter((p) => p.quality === q && p.size === s).length === 1,
    ),
  );
  return {
    ...base,
    OPENAI_IMAGE_MODEL: "elevenlabs/gpt-image-1.5",
    ENABLE_SCENE_IMAGE_GENERATION:
      base.ENABLE_SCENE_IMAGE_GENERATION &&
      !elevenLabsUnavailableReason(env, true) &&
      complete,
    MAX_REFERENCE_ASSETS_PER_GENERATION: Math.min(
      base.MAX_REFERENCE_ASSETS_PER_GENERATION,
      5,
    ),
    OPENAI_IMAGE_LOW_SQUARE_ESTIMATE_CENTS: price("low", true),
    OPENAI_IMAGE_LOW_RECTANGULAR_ESTIMATE_CENTS: price("low", false),
    OPENAI_IMAGE_MEDIUM_SQUARE_ESTIMATE_CENTS: price("medium", true),
    OPENAI_IMAGE_MEDIUM_RECTANGULAR_ESTIMATE_CENTS: price("medium", false),
    OPENAI_IMAGE_HIGH_SQUARE_ESTIMATE_CENTS: price("high", true),
    OPENAI_IMAGE_HIGH_RECTANGULAR_ESTIMATE_CENTS: price("high", false),
    OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS: 0,
    OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS: 0,
    OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS: 0,
    OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET: 0,
  };
}
