/**
 * The synthetic narration envelope that drives the character animation check.
 *
 * The production sprite reads its mouth state from an amplitude envelope
 * measured off real narration audio, and never fabricates timing. A character
 * has no narration of its own, so the check supplies a stand-in built here —
 * clearly synthetic, deterministic, and shaped like speech (syllable bursts
 * separated by breaths) so a viewer can tell at a glance whether the mouth is
 * tracking the signal or stuck.
 *
 * Values are already scaled 0..1, matching what `resampleAmplitudeEnvelope`
 * hands the renderer, so the sprite is exercised through exactly the input it
 * receives in a real video.
 */

/** Frames per second the check plays at. Independent of any project's setting. */
export const ANIMATION_TEST_FPS = 30;

/** Seconds of "talking" — the stretch covered by the synthetic envelope. */
export const ANIMATION_TEST_SPEAKING_SECONDS = 6;

/**
 * Seconds of silence appended after the envelope runs out.
 *
 * The sprite treats "past the end of the envelope" as idle rather than as a
 * closed mouth, so this tail is what makes the idle pose appear at all. Without
 * it the check would never show one of the four poses it is testing.
 */
export const ANIMATION_TEST_IDLE_SECONDS = 2;

export const ANIMATION_TEST_SPEAKING_FRAMES = Math.round(
  ANIMATION_TEST_SPEAKING_SECONDS * ANIMATION_TEST_FPS,
);

export const ANIMATION_TEST_DURATION_IN_FRAMES = Math.round(
  (ANIMATION_TEST_SPEAKING_SECONDS + ANIMATION_TEST_IDLE_SECONDS) *
    ANIMATION_TEST_FPS,
);

const SYLLABLES_PER_SECOND = 4.4;
const PHRASE_SECONDS = 2.2;
const BREATH_SECONDS = 0.5;
const SYLLABLE_PEAK = 0.86;
const SYLLABLE_FLOOR = 0.02;

function amplitudeAtSecond(seconds: number): number {
  const cycleSeconds = PHRASE_SECONDS + BREATH_SECONDS;
  const positionInCycle = seconds % cycleSeconds;
  if (positionInCycle >= PHRASE_SECONDS) return 0;

  const syllablePosition = positionInCycle * SYLLABLES_PER_SECOND;
  // Squared sine: silent at every syllable boundary, loudest mid-syllable, so
  // the mouth closes between syllables instead of hanging open.
  const shape = Math.sin(Math.PI * (syllablePosition % 1)) ** 2;
  // Rotating emphasis keeps it from looking metronomic while staying
  // deterministic — a random envelope would make the check unreproducible.
  const emphasis = 0.6 + 0.2 * (Math.floor(syllablePosition) % 3);
  const value =
    SYLLABLE_FLOOR + (SYLLABLE_PEAK - SYLLABLE_FLOOR) * shape * emphasis;
  return Math.min(1, Math.max(0, value));
}

/**
 * One synthetic amplitude value per frame, in 0..1.
 *
 * Returns an empty array for a non-positive frame count or frame rate rather
 * than throwing, matching the tolerance of the real resampler.
 */
export function createAnimationTestEnvelope(input: {
  frameCount: number;
  framesPerSecond: number;
}): number[] {
  if (input.frameCount <= 0 || input.framesPerSecond <= 0) return [];
  return Array.from({ length: input.frameCount }, (_unused, frame) =>
    amplitudeAtSecond(frame / input.framesPerSecond),
  );
}
