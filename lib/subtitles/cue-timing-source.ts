/**
 * Where a caption cue's timing came from, and what may be said about it.
 *
 * This module exists to make one failure impossible: a caption track that has
 * never been compared against speech describing itself as synchronised. The
 * application currently has no transcription or forced-alignment provider, so
 * no timing it produces knows where a word is. Three sources, and no fourth:
 *
 * - `estimated` — each line's share of the scene is its share of the
 *   characters. Nothing listened to the audio. This is the long-standing
 *   behaviour and is deliberately **not** relabelled by this slice.
 * - `pause_adjusted` — the line breaks were moved to silences measured in the
 *   recording. That places the *breaks* on real pauses; the words inside a line
 *   are still estimated, and the label says so rather than implying more.
 * - `manual` — a person set these times.
 *
 * The vocabulary is asserted by a test that refuses the words "aligned",
 * "synced" and "accurate" anywhere in it. If a real alignment provider is added
 * later, adding a fourth source has to be a deliberate edit here, which is the
 * point: the honest label cannot drift in by accident.
 */

export type CueTimingSource = "estimated" | "pause_adjusted" | "manual";

export interface CueTimingSourceDescription {
  label: string;
  detail: string;
}

const DESCRIPTIONS: Record<CueTimingSource, CueTimingSourceDescription> = {
  estimated: {
    label: "Estimated from text length",
    detail:
      "Each line gets a share of the scene based on how many characters it has. Nothing listened to the narration, so a slow sentence and a fast one of the same length get the same time.",
  },
  pause_adjusted: {
    label: "Snapped to pauses in the recording",
    detail:
      "Line breaks were moved to silences measured in the narration audio. Where a line starts and ends follows a real pause; the words inside it are still spread by character count.",
  },
  manual: {
    label: "Set by hand",
    detail:
      "Someone adjusted these times. They stay as they are until the narration for this scene is replaced.",
  },
};

export function describeCueTimingSource(
  source: CueTimingSource,
): CueTimingSourceDescription {
  return DESCRIPTIONS[source];
}

/**
 * The one-line summary for a whole track.
 *
 * A mixed track reports the weakest source it contains rather than the best
 * one. A reader who is told "snapped to pauses" and then finds two scenes that
 * were never touched has been given a worse answer than "estimated".
 */
export function summarizeTrackTimingSource(
  sources: readonly CueTimingSource[],
): CueTimingSource {
  if (sources.length === 0) return "estimated";
  if (sources.includes("estimated")) return "estimated";
  if (sources.includes("pause_adjusted")) return "pause_adjusted";
  return "manual";
}
