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
  | "title_generation"
  | "thumbnail_generation"
  | "idea_generation"
  | "video_publication"
  | "social_post_publication"
  | "marketing_chat_turn"
  | "marketing_content_generation"
  | "marketing_image_generation"
  | "marketing_research"
  | "custom_voice_enrollment";

/**
 * Enforces the per-workspace fixed-window rate limit for a billable operation,
 * throwing {@link RateLimitExceededError} when the window's request count exceeds
 * the configured maximum.
 *
 * Three ceilings, not one. Renders use their own (lower) limit because each is
 * expensive and long-running. Marketing **chat** gets a third: a conversation is
 * chatty by nature and a user sending ten messages in a minute is normal
 * behaviour, not abuse — sharing the generation ceiling would make ordinary use
 * look like an attack. Everything else shares the generation ceiling.
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
      : input.operation === "marketing_chat_turn"
        ? environment.RATE_LIMIT_MARKETING_CHAT_PER_WINDOW
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
