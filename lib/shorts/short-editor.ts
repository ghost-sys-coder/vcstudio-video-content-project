export interface ShortDraftClip {
  clientId: string;
  sourceSceneId: string;
  sourceSceneVersionId: string;
  sceneNumber: number;
  sourceStartMilliseconds: number;
  sourceEndMilliseconds: number;
  transition: "cut" | "fade";
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
