/**
 * Pure fixed-window rate-limit helpers. A window is a fixed calendar slice of
 * `windowSeconds`; every request in the same window shares one counter, and the
 * counter resets when the window rolls over.
 */

export function resolveRateWindowStart(now: Date, windowSeconds: number): Date {
  if (!Number.isInteger(windowSeconds) || windowSeconds <= 0)
    throw new RangeError("windowSeconds must be a positive integer.");
  if (Number.isNaN(now.getTime())) throw new RangeError("now must be valid.");
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function isOverRateLimit(count: number, maxPerWindow: number): boolean {
  if (!Number.isInteger(count) || count < 0)
    throw new RangeError("count must be a nonnegative integer.");
  if (!Number.isInteger(maxPerWindow) || maxPerWindow <= 0)
    throw new RangeError("maxPerWindow must be a positive integer.");
  return count > maxPerWindow;
}

export function buildRateLimitKey(parts: {
  workspaceId: string;
  operation: string;
}): string {
  return `workspace:${parts.workspaceId}:${parts.operation}`;
}
