import "server-only";

import type { SceneImageOutputCostMatrix } from "@/lib/costs/scene-image-cost";
import type { SceneImageEnvironment } from "@/lib/env/server-schema";
import type { SceneImageQuality } from "@/lib/schemas/scene-image";

export function createSceneImageOutputCostMatrix(
  environment: SceneImageEnvironment,
): SceneImageOutputCostMatrix {
  return {
    low: {
      "1024x1024": environment.OPENAI_IMAGE_LOW_SQUARE_ESTIMATE_CENTS,
      "1024x1536": environment.OPENAI_IMAGE_LOW_RECTANGULAR_ESTIMATE_CENTS,
      "1536x1024": environment.OPENAI_IMAGE_LOW_RECTANGULAR_ESTIMATE_CENTS,
    },
    medium: {
      "1024x1024": environment.OPENAI_IMAGE_MEDIUM_SQUARE_ESTIMATE_CENTS,
      "1024x1536": environment.OPENAI_IMAGE_MEDIUM_RECTANGULAR_ESTIMATE_CENTS,
      "1536x1024": environment.OPENAI_IMAGE_MEDIUM_RECTANGULAR_ESTIMATE_CENTS,
    },
    high: {
      "1024x1024": environment.OPENAI_IMAGE_HIGH_SQUARE_ESTIMATE_CENTS,
      "1024x1536": environment.OPENAI_IMAGE_HIGH_RECTANGULAR_ESTIMATE_CENTS,
      "1536x1024": environment.OPENAI_IMAGE_HIGH_RECTANGULAR_ESTIMATE_CENTS,
    },
  };
}

export function getSceneImageCompression(
  environment: SceneImageEnvironment,
  quality: SceneImageQuality,
): number {
  return quality === "low"
    ? environment.OPENAI_IMAGE_DRAFT_COMPRESSION
    : environment.OPENAI_IMAGE_FINAL_COMPRESSION;
}
