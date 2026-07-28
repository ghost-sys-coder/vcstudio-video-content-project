import { AbsoluteFill } from "remotion";
import { CharacterSprite } from "@/remotion/CharacterSprite";
import type { VideoCompositionSceneCharacter } from "@/lib/render/video-composition-data";

/** Frames of blink offset between characters so a cast never blinks in unison. */
const BLINK_STAGGER_FRAMES = 17;

/**
 * Draws a scene's animated cast over its background plate.
 *
 * Sits outside `CameraMotion` on purpose: a camera move that scaled the plate
 * would also scale the characters away from their stage positions, and the
 * sprites are already composed for the frame.
 */
export function CharacterSpriteLayer({
  characters,
  sceneId,
}: {
  characters: VideoCompositionSceneCharacter[];
  sceneId: string;
}) {
  if (characters.length === 0) return null;

  // Left-to-right so a character standing in front overlaps predictably rather
  // than depending on assignment order.
  const ordered = [...characters].sort((left, right) => {
    const order = { left: 0, center: 1, right: 2 } as const;
    return order[left.stageSlot] - order[right.stageSlot];
  });

  return (
    <AbsoluteFill>
      {ordered.map((character, index) => (
        <CharacterSprite
          blinkOffsetFrames={index * BLINK_STAGGER_FRAMES}
          character={character}
          key={character.characterId}
          sceneId={sceneId}
        />
      ))}
    </AbsoluteFill>
  );
}
