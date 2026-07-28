/**
 * Pure amplitude-envelope math, deliberately free of `server-only` and of any
 * ffmpeg dependency so it can be used from the render snapshot builder and the
 * composition input builder without dragging a binary-invoking module along.
 * The ffmpeg decode itself lives in `lib/media/audio-amplitude.ts`.
 */

/**
 * Samples per second in a stored envelope.
 *
 * Deliberately independent of any project's frame rate: the envelope is
 * computed once when the narration audio is produced and reused by every render
 * and preview afterwards, so it must survive a project changing its fps. 50 Hz
 * is ~1 sample per frame at 60fps — finer than a mouth can move.
 */
export const AMPLITUDE_ENVELOPE_SAMPLE_RATE_HZ = 50;

/**
 * Stored envelopes are integer percentages (0-100) rather than floats purely
 * for size: a 60-second clip is 3000 samples, and full-precision floats would
 * roughly quadruple the stored JSON for precision no mouth-open threshold can
 * use.
 */
export const AMPLITUDE_SCALE = 100;

/**
 * Converts a stored fixed-rate envelope into one value per video frame, scaled
 * back to 0..1 for the renderer.
 *
 * Tolerant of a short or missing envelope: frames past the end read 0 (mouth
 * closed) rather than throwing, so a truncated envelope degrades to a quiet
 * character instead of a failed render.
 */
export function resampleAmplitudeEnvelope(input: {
  envelope: readonly number[];
  envelopeSampleRateHz: number;
  frameCount: number;
  framesPerSecond: number;
}): number[] {
  if (input.frameCount <= 0) return [];
  const frames = new Array<number>(input.frameCount).fill(0);
  if (
    input.envelope.length === 0 ||
    input.framesPerSecond <= 0 ||
    input.envelopeSampleRateHz <= 0
  )
    return frames;

  for (let frame = 0; frame < input.frameCount; frame++) {
    const seconds = frame / input.framesPerSecond;
    const index = Math.floor(seconds * input.envelopeSampleRateHz);
    const value = index < input.envelope.length ? input.envelope[index] : 0;
    frames[frame] = Math.min(1, Math.max(0, (value ?? 0) / AMPLITUDE_SCALE));
  }
  return frames;
}
