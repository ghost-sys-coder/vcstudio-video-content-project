/**
 * Decides when each image in a multi-image scene appears.
 *
 * A scene may hold several approved stills ("shots"). They divide the scene's
 * narration between them, and a change is placed on a **caption boundary**: the
 * moment a new caption line appears. That is deliberate. Caption boundaries are
 * already the best record this application has of where the narrator paused,
 * because V2-12 snaps them onto silences measured in the recording. Reusing
 * them means an image change lands in a gap in the voice instead of over a
 * word, and it costs nothing extra to compute.
 *
 * What this cannot do is decide *which* image belongs to which sentence. It
 * divides the scene by time and then moves each division to the nearest place a
 * caption changes. A scene with two images and eight caption lines will change
 * image near the middle, not at the semantically right moment.
 *
 * Honesty about quality is deferred to the caller: these boundaries are only as
 * good as the caption times they sit on, so a caller reports the caption timing
 * source rather than inventing a second vocabulary for shots.
 */

/**
 * The shortest a single image may stay on screen.
 *
 * Below roughly a second an image change reads as a glitch rather than as a
 * cut, and the viewer registers the flicker instead of the picture. It also
 * bounds how many images a short scene can meaningfully hold.
 */
export const MINIMUM_SHOT_DURATION_MILLISECONDS = 1200;

/**
 * Ceiling on images in one scene.
 *
 * A scene changes image on caption boundaries, so a scene with more images
 * than caption lines cannot place them all. This is generous rather than
 * restrictive: it bounds queries and form input, and is not a creative limit.
 *
 * Lives here, in a module with no server-only dependency, because both the
 * repository and the request schemas need it and the schemas are reachable
 * from client components.
 */
export const MAX_SHOTS_PER_SCENE = 12;

export type ShotPlacement = {
  shotIndex: number;
  startMilliseconds: number;
  endMilliseconds: number;
  /**
   * False when this shot's start had to be placed by even division because no
   * caption boundary was usable there. A caller must not describe such a shot
   * as following the narration.
   */
  startedOnCueBoundary: boolean;
};

export type ShotPlacementResult = {
  shots: ShotPlacement[];
  /** Interior boundaries actually placed on a caption change. */
  cuePlacedBoundaryCount: number;
  /** Interior boundaries needing placement. Zero for a single-shot scene. */
  interiorBoundaryCount: number;
};

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * @param cueStartMilliseconds Scene-relative start of every caption line, in
 * any order. The line starting at zero is ignored: a scene cannot change image
 * at its own beginning.
 */
export function placeShotsOnCueBoundaries(input: {
  shotCount: number;
  sceneDurationMilliseconds: number;
  cueStartMilliseconds: readonly number[];
  minimumShotDurationMilliseconds: number;
}): ShotPlacementResult {
  const duration = Math.max(0, Math.round(input.sceneDurationMilliseconds));
  const minimum = Math.max(
    0,
    Math.round(input.minimumShotDurationMilliseconds),
  );
  const shotCount = Math.max(1, Math.floor(input.shotCount));

  const single = (): ShotPlacementResult => ({
    shots: [
      {
        shotIndex: 0,
        startMilliseconds: 0,
        endMilliseconds: duration,
        startedOnCueBoundary: false,
      },
    ],
    cuePlacedBoundaryCount: 0,
    interiorBoundaryCount: 0,
  });

  if (shotCount === 1 || duration === 0) return single();

  // A scene too short to give every shot a readable moment keeps the first
  // image for its whole length. Showing four images in a second is not a
  // shorter version of the intent; it is a different, worse thing.
  if (minimum > 0 && duration < shotCount * minimum) return single();

  const candidates = [...new Set(input.cueStartMilliseconds)]
    .map((value) => Math.round(value))
    .filter((value) => value > 0 && value < duration)
    .sort((left, right) => left - right);

  const used = new Set<number>();
  const boundaries: { value: number; onCue: boolean }[] = [];
  let previous = 0;

  for (let index = 1; index < shotCount; index += 1) {
    const ideal = Math.round((index * duration) / shotCount);
    // Every later shot still needs its minimum, so this boundary cannot be
    // pushed arbitrarily late even when a caption sits there.
    const lowest = previous + minimum;
    const highest = duration - (shotCount - index) * minimum;

    let chosen: number | null = null;
    if (lowest <= highest) {
      for (const candidate of candidates) {
        if (used.has(candidate)) continue;
        if (candidate < lowest || candidate > highest) continue;
        if (
          chosen === null ||
          Math.abs(candidate - ideal) < Math.abs(chosen - ideal)
        )
          chosen = candidate;
      }
    }

    if (chosen !== null) {
      used.add(chosen);
      boundaries.push({ value: chosen, onCue: true });
      previous = chosen;
      continue;
    }

    // No caption change was usable here. Fall back to even division, clamped so
    // the track stays legal, and record that this one does not follow the
    // narration.
    const fallback = clamp(ideal, lowest, Math.max(lowest, highest));
    boundaries.push({ value: fallback, onCue: false });
    previous = fallback;
  }

  const edges = [0, ...boundaries.map((entry) => entry.value), duration];
  const shots: ShotPlacement[] = [];
  for (let index = 0; index < shotCount; index += 1) {
    shots.push({
      shotIndex: index,
      startMilliseconds: edges[index] ?? 0,
      endMilliseconds: edges[index + 1] ?? duration,
      startedOnCueBoundary:
        index === 0 ? false : Boolean(boundaries[index - 1]?.onCue),
    });
  }

  return {
    shots,
    cuePlacedBoundaryCount: boundaries.filter((entry) => entry.onCue).length,
    interiorBoundaryCount: boundaries.length,
  };
}
