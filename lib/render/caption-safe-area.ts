export interface CaptionSafeArea {
  marginXPixels: number;
  marginYPixels: number;
  safeWidthPixels: number;
  safeHeightPixels: number;
}

export const MAX_SAFE_MARGIN_PERCENT = 40;

/**
 * Computes the caption-safe rectangle inside the frame. Captions must never
 * touch the frame edge (players and platform chrome crop it), so a symmetric
 * margin proportional to each axis is reserved. The margin percentage is
 * clamped to a sane maximum so a misconfiguration can never collapse the safe
 * area to nothing.
 */
export function computeCaptionSafeArea(input: {
  width: number;
  height: number;
  safeMarginPercent: number;
}): CaptionSafeArea {
  if (!Number.isInteger(input.width) || input.width <= 0)
    throw new RangeError("Width must be a positive integer.");
  if (!Number.isInteger(input.height) || input.height <= 0)
    throw new RangeError("Height must be a positive integer.");

  const percent = Math.min(
    Math.max(input.safeMarginPercent, 0),
    MAX_SAFE_MARGIN_PERCENT,
  );
  const marginXPixels = Math.round((input.width * percent) / 100);
  const marginYPixels = Math.round((input.height * percent) / 100);

  return {
    marginXPixels,
    marginYPixels,
    safeWidthPixels: input.width - marginXPixels * 2,
    safeHeightPixels: input.height - marginYPixels * 2,
  };
}
