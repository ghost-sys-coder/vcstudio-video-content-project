export type RenderDurationValidation =
  { ok: true } | { ok: false; reason: string };

export function renderDurationSeconds(durationMilliseconds: number): number {
  if (!Number.isInteger(durationMilliseconds) || durationMilliseconds < 0)
    throw new RangeError(
      "Duration milliseconds must be a nonnegative integer.",
    );
  return durationMilliseconds / 1000;
}

/**
 * Validates a proposed render against the configured maximum duration. This is
 * one of the required cost-control limits: a render longer than the cap is
 * rejected before any compute is spent.
 */
export function validateRenderDuration(input: {
  durationMilliseconds: number;
  maxRenderDurationSeconds: number;
}): RenderDurationValidation {
  if (input.durationMilliseconds <= 0)
    return { ok: false, reason: "The timeline has no playable duration." };

  const seconds = renderDurationSeconds(input.durationMilliseconds);
  if (seconds > input.maxRenderDurationSeconds)
    return {
      ok: false,
      reason: `The video is ${Math.round(seconds)}s long, which exceeds the ${input.maxRenderDurationSeconds}s render limit.`,
    };

  return { ok: true };
}
