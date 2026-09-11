/**
 * Moving caption line breaks onto silences that were actually measured in the
 * narration audio.
 *
 * **What this is.** Every narration clip already carries an amplitude envelope,
 * sampled at a fixed rate when the audio was produced, because the renderer
 * needs it for mouth movement. That envelope is a free, exact record of when
 * the recording was loud and when it was quiet. A caption break that lands in
 * the middle of a spoken word is the most visible timing fault there is, and a
 * break placed on a measured pause fixes it without any provider, any cost, and
 * any new data.
 *
 * **What this is not.** It cannot tell which word is being spoken. It knows
 * only where sound stops. So it never produces alignment, and nothing built on
 * it may claim alignment; see `cue-timing-source.ts`.
 *
 * **Why it adjusts rather than decides.** The estimated boundaries come first
 * and a boundary only moves to a pause within a bounded distance of where it
 * already was. Choosing pauses freely would be worse than the estimate whenever
 * the count of pauses and the count of lines disagree — a narrator who pauses
 * mid-sentence for effect would drag a break onto the wrong phrase. Bounded
 * movement can only correct a boundary that was nearly right; it cannot invent
 * a structure the text does not have.
 */

export interface SilenceWindow {
  startMilliseconds: number;
  endMilliseconds: number;
}

/**
 * Loudness at or below this percentage counts as silence.
 *
 * Stored envelopes are integer percentages of full scale. Room tone and the
 * breath before a line sit well under ten; conversational speech sits far
 * above. The threshold is deliberately low, because a false silence inside
 * speech is worse than a missed pause: a missed pause leaves the estimate
 * alone, while a false one moves a break into a word.
 */
export const SILENCE_THRESHOLD_PERCENT = 10;

/** Shorter dips are the gaps between syllables, not pauses between phrases. */
export const MINIMUM_SILENCE_MILLISECONDS = 140;

/** How far a boundary may travel to reach a pause. */
export const PAUSE_SNAP_TOLERANCE_MILLISECONDS = 400;

/**
 * Quiet stretches in a stored envelope, in milliseconds from the clip start.
 *
 * Leading and trailing silence are included: a clip that opens with half a
 * second of room tone is exactly the case where the first caption should not
 * appear at zero.
 */
export function findSilenceWindows(input: {
  envelope: readonly number[];
  sampleRateHz: number;
  thresholdPercent?: number;
  minimumDurationMilliseconds?: number;
}): SilenceWindow[] {
  const { envelope, sampleRateHz } = input;
  if (envelope.length === 0 || sampleRateHz <= 0) return [];
  const threshold = input.thresholdPercent ?? SILENCE_THRESHOLD_PERCENT;
  const minimum =
    input.minimumDurationMilliseconds ?? MINIMUM_SILENCE_MILLISECONDS;
  const millisecondsPerSample = 1000 / sampleRateHz;

  const windows: SilenceWindow[] = [];
  let runStart: number | null = null;
  for (let index = 0; index <= envelope.length; index += 1) {
    const quiet =
      index < envelope.length && (envelope[index] ?? 0) <= threshold;
    if (quiet) {
      if (runStart === null) runStart = index;
      continue;
    }
    if (runStart === null) continue;
    const startMilliseconds = Math.round(runStart * millisecondsPerSample);
    const endMilliseconds = Math.round(index * millisecondsPerSample);
    if (endMilliseconds - startMilliseconds >= minimum)
      windows.push({ startMilliseconds, endMilliseconds });
    runStart = null;
  }
  return windows;
}

export interface SnapResult {
  /** Interior boundaries, ascending, in milliseconds from the scene start. */
  boundaries: number[];
  /** How many boundaries actually moved. Zero means nothing was adjusted. */
  movedCount: number;
}

function midpoint(window: SilenceWindow): number {
  return Math.round((window.startMilliseconds + window.endMilliseconds) / 2);
}

/**
 * Moves each interior boundary to the middle of a nearby measured pause.
 *
 * Boundaries are placed left to right, each one constrained by the boundary
 * already placed before it and by the minimum cue length on both sides, so the
 * result is always ordered, never overlapping, and never shorter than a
 * readable cue. A pause is consumed by the boundary that takes it, so two
 * breaks can never collapse onto the same silence.
 *
 * `movedCount` is returned rather than inferred, because a caller must be able
 * to say "estimated" when nothing moved instead of claiming an adjustment that
 * did not happen.
 */
export function snapBoundariesToPauses(input: {
  boundaries: readonly number[];
  silences: readonly SilenceWindow[];
  sceneDurationMilliseconds: number;
  minimumCueDurationMilliseconds: number;
  toleranceMilliseconds?: number;
}): SnapResult {
  const tolerance =
    input.toleranceMilliseconds ?? PAUSE_SNAP_TOLERANCE_MILLISECONDS;
  const minimum = Math.max(0, input.minimumCueDurationMilliseconds);
  const candidates = input.silences
    .map(midpoint)
    .filter((value) => value > 0 && value < input.sceneDurationMilliseconds)
    .sort((left, right) => left - right);
  const used = new Set<number>();

  const placed: number[] = [];
  let movedCount = 0;
  let previous = 0;

  input.boundaries.forEach((boundary, index) => {
    const remaining = input.boundaries.length - index - 1;
    // Leave room for this cue on the left and for every cue still to come.
    const lowest = previous + minimum;
    const highest = input.sceneDurationMilliseconds - minimum * (remaining + 1);

    let chosen = boundary;
    if (highest >= lowest) {
      let best: number | null = null;
      let bestDistance = tolerance + 1;
      for (const candidate of candidates) {
        if (used.has(candidate)) continue;
        if (candidate < lowest || candidate > highest) continue;
        const distance = Math.abs(candidate - boundary);
        if (distance < bestDistance) {
          best = candidate;
          bestDistance = distance;
        }
      }
      if (best !== null) {
        used.add(best);
        if (best !== boundary) movedCount += 1;
        chosen = best;
      }
      chosen = Math.min(Math.max(chosen, lowest), highest);
    }
    placed.push(chosen);
    previous = chosen;
  });

  return { boundaries: placed, movedCount };
}
