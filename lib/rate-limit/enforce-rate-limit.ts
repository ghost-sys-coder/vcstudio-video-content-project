import "server-only";

import { incrementRateLimitCount } from "@/db/repositories/rate-limit.repository";
import { RateLimitExceededError } from "@/lib/domain/errors";
import { getUsageEnvironment } from "@/lib/env/server";
import {
  buildRateLimitKey,
  isOverRateLimit,
  resolveRateWindowStart,
} from "@/lib/rate-limit/rate-limit";

export type RateLimitedOperation =
  | "scene_analysis"
  | "scene_image_generation"
  | "scene_audio_generation"
  | "video_render"
  | "script_generation"
  | "title_generation";

/**
 * Enforces the per-workspace fixed-window rate limit for a billable operation,
 * throwing {@link RateLimitExceededError} when the window's request count exceeds
 * the configured maximum. Renders use their own (typically lower) ceiling; all
 * other billable operations share the generation ceiling.
 */
export async function enforceRateLimit(input: {
  workspaceId: string;
  operation: RateLimitedOperation;
  now?: Date;
}): Promise<void> {
  const environment = getUsageEnvironment();
  const maxPerWindow =
    input.operation === "video_render"
      ? environment.RATE_LIMIT_RENDERS_PER_WINDOW
      : environment.RATE_LIMIT_GENERATIONS_PER_WINDOW;

  const windowStart = resolveRateWindowStart(
    input.now ?? new Date(),
    environment.RATE_LIMIT_WINDOW_SECONDS,
  );
  const scopeKey = buildRateLimitKey({
    workspaceId: input.workspaceId,
    operation: input.operation,
  });
  const count = await incrementRateLimitCount({ scopeKey, windowStart });
  if (isOverRateLimit(count, maxPerWindow))
    throw new RateLimitExceededError(input.operation);
}
