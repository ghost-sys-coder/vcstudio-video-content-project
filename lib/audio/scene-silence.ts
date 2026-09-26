import {
  findSilenceWindows,
  MINIMUM_SILENCE_MILLISECONDS,
  SILENCE_THRESHOLD_PERCENT,
} from "@/lib/subtitles/pause-alignment";

/**
 * Dead air at the ends of a narration clip, and what removing it would save.
 *
 * **A scene that feels slow is usually not slow speech.** It is a clip that
 * opens with room tone before the first word and runs on after the last one.
 * Speeding the delivery up fixes that by damaging the part that was fine; the
 * silence is the part that is actually wrong.
 *
 * Nothing here is invented. Every narration clip already carries an amplitude
 * envelope — measured when the audio was produced, so the renderer can move a
 * mouth — and `findSilenceWindows` already reads quiet stretches out of it for
 * caption placement. This asks that same record a narrower question: how much
 * of the quiet is at the ends, where removing it shortens the video and changes
 * nothing a listener would call the performance.
 *
 * **It measures; it does not cut.** Reporting a saving is safe. Applying one
 * moves every scene boundary after it, and caption times are laid out from
 * those boundaries before the render timeline is built, so a trim that skipped
 * that chain would desynchronise the subtitles of a paid render. The decision
 * is recorded here and honoured where durations enter, not applied in passing.
 */

/**
 * Left at each end rather than cutting to the first loud sample.
 *
 * A clip that starts on the attack of a consonant sounds clipped, and the
 * breath before a line is part of how the line reads. Removing the dead air
 * should be inaudible, which means leaving a little of it.
 */
export const SILENCE_BREATH_MILLISECONDS = 120;

/**
 * Below this, trimming is not worth reporting.
 *
 * A tenth of a second saved per scene is invisible in the finished video and
 * would fill the interface with scenes not worth acting on.
 */
export const MINIMUM_REPORTABLE_SAVING_MILLISECONDS = 250;

export interface SceneSilence {
  /** Quiet at the start, after the breath allowance. */
  leadingMilliseconds: number;
  /** Quiet at the end, after the breath allowance. */
  trailingMilliseconds: number;
  /** What the scene would run to with both removed. */
  trimmedDurationMilliseconds: number;
  savedMilliseconds: number;
  /** False when there is no envelope, so nothing was measured. */
  measured: boolean;
}

const NOTHING = (durationMilliseconds: number): SceneSilence => ({
  leadingMilliseconds: 0,
  trailingMilliseconds: 0,
  trimmedDurationMilliseconds: Math.max(0, Math.round(durationMilliseconds)),
  savedMilliseconds: 0,
  measured: false,
});

export function measureSceneSilence(input: {
  envelope: readonly number[] | null | undefined;
  sampleRateHz: number | null | undefined;
  durationMilliseconds: number;
}): SceneSilence {
  const duration = Math.round(input.durationMilliseconds);
  if (!Number.isFinite(duration) || duration <= 0) return NOTHING(0);

  // No envelope means the clip predates the measurement or was recorded
  // elsewhere. Guessing at silence from a duration alone would be fabrication.
  if (
    !input.envelope ||
    input.envelope.length === 0 ||
    !input.sampleRateHz ||
    input.sampleRateHz <= 0
  )
    return NOTHING(duration);

  const windows = findSilenceWindows({
    envelope: input.envelope,
    sampleRateHz: input.sampleRateHz,
    thresholdPercent: SILENCE_THRESHOLD_PERCENT,
    minimumDurationMilliseconds: MINIMUM_SILENCE_MILLISECONDS,
  });

  const opening = windows.find((window) => window.startMilliseconds === 0);
  const closing = [...windows]
    .reverse()
    .find((window) => window.endMilliseconds >= duration);

  const leading = opening
    ? Math.max(0, opening.endMilliseconds - SILENCE_BREATH_MILLISECONDS)
    : 0;
  const trailing = closing
    ? Math.max(
        0,
        duration - closing.startMilliseconds - SILENCE_BREATH_MILLISECONDS,
      )
    : 0;

  // A clip that is silence end to end would otherwise trim to nothing. Whatever
  // is wrong with it, a zero-length scene is not the fix.
  if (leading + trailing >= duration) return NOTHING(duration);

  return {
    leadingMilliseconds: leading,
    trailingMilliseconds: trailing,
    trimmedDurationMilliseconds: duration - leading - trailing,
    savedMilliseconds: leading + trailing,
    measured: true,
  };
}

export interface SceneSilenceRow {
  sceneId: string;
  sceneNumber: number;
  durationMilliseconds: number;
  silence: SceneSilence;
}

export interface SilenceSummary {
  /** Scenes with a saving worth acting on. */
  trimmableSceneCount: number;
  /** Scenes whose audio carries no envelope, so nothing could be measured. */
  unmeasuredSceneCount: number;
  totalSavedMilliseconds: number;
  currentDurationMilliseconds: number;
  trimmedDurationMilliseconds: number;
}

/**
 * What trimming would do to the whole video.
 *
 * Only savings above the reportable floor are counted, so the headline figure
 * matches the scenes actually listed rather than quietly including dozens of
 * scenes each saving a few frames.
 */
export function summariseSceneSilence(
  rows: readonly SceneSilenceRow[],
): SilenceSummary {
  let totalSaved = 0;
  let trimmable = 0;
  let unmeasured = 0;
  let current = 0;

  for (const row of rows) {
    current += row.durationMilliseconds;
    if (!row.silence.measured) {
      unmeasured += 1;
      continue;
    }
    if (row.silence.savedMilliseconds < MINIMUM_REPORTABLE_SAVING_MILLISECONDS)
      continue;
    trimmable += 1;
    totalSaved += row.silence.savedMilliseconds;
  }

  return {
    trimmableSceneCount: trimmable,
    unmeasuredSceneCount: unmeasured,
    totalSavedMilliseconds: totalSaved,
    currentDurationMilliseconds: current,
    trimmedDurationMilliseconds: current - totalSaved,
  };
}

/** True when this scene is worth offering a trim for. */
export function isWorthTrimming(silence: SceneSilence): boolean {
  return (
    silence.measured &&
    silence.savedMilliseconds >= MINIMUM_REPORTABLE_SAVING_MILLISECONDS
  );
}
