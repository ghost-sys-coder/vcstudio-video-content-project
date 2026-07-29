import { AbsoluteFill } from "remotion";
import { CharacterSpriteLayer } from "@/remotion/CharacterSpriteLayer";
import { CheckerboardBackdrop } from "@/remotion/CheckerboardBackdrop";
import type { VideoCompositionSceneCharacter } from "@/lib/render/video-composition-data";

/** Stands in for a scene id in the sprite's preview telemetry. */
export const ANIMATION_TEST_SCENE_ID = "character-animation-check";

// A type alias rather than an interface so it satisfies the
// `Record<string, unknown>` constraint the Player puts on input props.
export type CharacterAnimationTestProps = {
  character: VideoCompositionSceneCharacter;
};

/**
 * The character animation check's composition: one character, over a
 * transparency checkerboard, driven by a synthetic narration envelope.
 *
 * It goes through {@link CharacterSpriteLayer} rather than reaching for the
 * sprite directly, so stage positioning and pose toggling are exercised by the
 * same code a finished video uses. Only the backdrop and the envelope are
 * stand-ins; everything the check is actually testing is production code.
 */
export function CharacterAnimationTestComposition({
  character,
}: CharacterAnimationTestProps) {
  return (
    <AbsoluteFill>
      <CheckerboardBackdrop />
      <CharacterSpriteLayer
        characters={[character]}
        sceneId={ANIMATION_TEST_SCENE_ID}
      />
    </AbsoluteFill>
  );
}
