export interface ShortDraftClip {
  clientId: string;
  sourceSceneId: string;
  sourceSceneVersionId: string;
  sceneNumber: number;
  sourceStartMilliseconds: number;
  sourceEndMilliseconds: number;
  transition: "cut" | "fade";
}

/** Sums `end - start` across a set of trimmed ranges (source scenes or clips). */
export function sumDurationMilliseconds(
  ranges: { startMilliseconds: number; endMilliseconds: number }[],
): number {
  return ranges.reduce(
    (total, range) => total + (range.endMilliseconds - range.startMilliseconds),
    0,
  );
}

export function snapToNearestBoundary(
  milliseconds: number,
  boundaries: number[],
): number {
  if (boundaries.length === 0) return milliseconds;
  return boundaries.reduce((nearest, candidate) =>
    Math.abs(candidate - milliseconds) < Math.abs(nearest - milliseconds)
      ? candidate
      : nearest,
  );
}
