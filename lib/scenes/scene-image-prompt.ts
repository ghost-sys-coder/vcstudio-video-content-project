import {
  renderSceneImagePrompt,
  type SceneImagePromptCharacter,
  type SceneImagePromptMode,
} from "@studio/prompts";
import type { Character, ProjectVideoKind, SceneVersion } from "@/db/schema";
import type {
  SceneImageApiSize,
  SceneImageReferenceView,
  SceneImageStylePresetView,
} from "@/lib/scenes/scene-image-view";
import { getSceneImageDimensions } from "@/lib/schemas/scene-image";

export function toSceneImagePromptCharacter(
  character: Character,
): SceneImagePromptCharacter {
  return {
    id: character.id,
    name: character.name,
    description: character.description,
    visualIdentity: character.visualIdentity,
    bodyProportions: character.bodyProportions,
    faceDescription: character.faceDescription,
    hairDescription: character.hairDescription,
    skinToneDescription: character.skinToneDescription,
    defaultOutfitDescription: character.defaultOutfitDescription,
    personalityNotes: character.personalityNotes,
    continuityRules: character.continuityRules,
    negativeConstraints: character.negativeConstraints,
  };
}

/**
 * An animated project's scene still is a background plate that its character
 * sprites are drawn over, so generating the cast into it would show every
 * character twice.
 */
export function sceneImagePromptModeForVideoKind(
  videoKind: ProjectVideoKind,
): SceneImagePromptMode {
  return videoKind === "animatedCharacter" ? "backgroundPlate" : "scene";
}

export function createSceneImagePromptPreview(input: {
  stylePreset: SceneImageStylePresetView;
  characters: Character[];
  references: SceneImageReferenceView[];
  sceneVersion: SceneVersion;
  size: SceneImageApiSize;
  aspectRatio: "16:9" | "9:16" | "1:1";
  mode?: SceneImagePromptMode;
}): string {
  const dimensions = getSceneImageDimensions(input.size);
  return renderSceneImagePrompt({
    mode: input.mode ?? "scene",
    stylePreset: {
      name: input.stylePreset.name,
      description: input.stylePreset.description,
      positivePrompt: input.stylePreset.positivePrompt,
      negativePrompt: input.stylePreset.negativePrompt,
      version: input.stylePreset.version,
    },
    characters: input.characters.map(toSceneImagePromptCharacter),
    references: input.references.map((reference) => ({
      assetId: reference.id,
      characterId: reference.characterId,
      characterName: reference.characterName,
      referenceType: reference.referenceType,
    })),
    scene: {
      visualDescription: input.sceneVersion.visualDescription,
      locationDescription: input.sceneVersion.locationDescription,
      actionDescription: input.sceneVersion.actionDescription,
      cameraShot: input.sceneVersion.cameraShot,
      cameraAngle: input.sceneVersion.cameraAngle,
      cameraMotion: input.sceneVersion.cameraMotion,
      emotionalTone: input.sceneVersion.emotionalTone,
      propNames: input.sceneVersion.propNames,
      continuityNotes: input.sceneVersion.continuityNotes,
    },
    output: {
      ...dimensions,
      aspectRatio: input.aspectRatio,
    },
  });
}
