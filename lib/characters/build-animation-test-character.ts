/**
 * Assembles the exact prop shape the production sprite receives in a real
 * render, from a character's measured pose diagnostics plus the synthetic
 * narration envelope.
 *
 * The check is only worth anything if it drives the same component down the
 * same path as a finished video, so this builds a
 * {@link VideoCompositionSceneCharacter} rather than a test-only shape.
 */

import {
  ANIMATION_TEST_FPS,
  ANIMATION_TEST_SPEAKING_FRAMES,
  createAnimationTestEnvelope,
} from "@/lib/characters/animation-test-envelope";
import type { AnimationPoseDiagnostic } from "@/lib/characters/animation-check-view";
import type { VideoCompositionSceneCharacter } from "@/lib/render/video-composition-data";

function urlFor(
  poses: AnimationPoseDiagnostic[],
  pose: AnimationPoseDiagnostic["pose"],
): string | null {
  return poses.find((item) => item.pose === pose)?.previewUrl ?? null;
}

/**
 * Returns null when any pose still is missing a signed URL — a partial sprite
 * would pop between a present and an absent image, which is the same reason the
 * renderer skips incomplete characters outright.
 */
export function buildAnimationTestCharacter(input: {
  characterId: string;
  poses: AnimationPoseDiagnostic[];
  faceLeft: boolean;
}): VideoCompositionSceneCharacter | null {
  const idleUrl = urlFor(input.poses, "idle");
  const talkOpenUrl = urlFor(input.poses, "talkOpen");
  const talkClosedUrl = urlFor(input.poses, "talkClosed");
  const blinkUrl = urlFor(input.poses, "blink");
  if (!idleUrl || !talkOpenUrl || !talkClosedUrl || !blinkUrl) return null;

  return {
    characterId: input.characterId,
    stageSlot: "center",
    isSpeaker: true,
    faceLeft: input.faceLeft,
    idleUrl,
    talkOpenUrl,
    talkClosedUrl,
    blinkUrl,
    amplitudeEnvelope: createAnimationTestEnvelope({
      frameCount: ANIMATION_TEST_SPEAKING_FRAMES,
      framesPerSecond: ANIMATION_TEST_FPS,
    }),
  };
}
