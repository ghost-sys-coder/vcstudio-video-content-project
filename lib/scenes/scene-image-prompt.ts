import {
  renderSceneImagePrompt,
  type SceneImagePromptCharacter,
} from "@studio/prompts";
import type { Character, SceneVersion } from "@/db/schema";
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

export function createSceneImagePromptPreview(input: {
  stylePreset: SceneImageStylePresetView;
  characters: Character[];
  references: SceneImageReferenceView[];
  sceneVersion: SceneVersion;
  size: SceneImageApiSize;
  aspectRatio: "16:9" | "9:16" | "1:1";
}): string {
  const dimensions = getSceneImageDimensions(input.size);
  return renderSceneImagePrompt({
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
