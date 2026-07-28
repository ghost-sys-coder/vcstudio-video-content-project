import type { SceneCharacterStageSlot } from "@/db/schema";

/**
 * Per-scene staging for one assigned character in an animated project.
 *
 * Carried alongside `assignedCharacters` rather than folded into it because the
 * scene-image prompt preview consumes the plain `Character[]` and has no use for
 * staging — keeping them separate avoids reshaping that path.
 */
export type SceneCharacterStaging = {
  characterId: string;
  stageSlot: SceneCharacterStageSlot;
  isSpeaker: boolean;
};
