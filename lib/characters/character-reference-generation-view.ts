import "server-only";

import type {
  Character,
  CharacterReferenceGenerationStatus,
} from "@/db/schema";
import {
  renderCharacterReferencePrompt,
  type CharacterReferenceView,
} from "@studio/prompts";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import { listCharacterReferenceGenerations } from "@/db/repositories/character-reference-generation.repository";
import { listCharacterReferences } from "@/db/repositories/characters.repository";

export type PortraitViewOption = {
  type: CharacterReferenceView;
  label: string;
  estimatedCostCents: number;
};

export type PortraitGenerationRow = {
  id: string;
  referenceType: string;
  status: CharacterReferenceGenerationStatus;
  estimatedCostCents: number;
  actualCostCents: number | null;
  createdAtLabel: string;
  safeErrorMessage: string | null;
};

export type CharacterPortraitView = {
  enabled: boolean;
  model: string;
  views: PortraitViewOption[];
  recent: PortraitGenerationRow[];
};

const viewLabels: Record<CharacterReferenceView, string> = {
  master: "Master identity",
  front: "Front view",
  threeQuarter: "Three-quarter view",
  side: "Side view",
  fullBody: "Full-body view",
  poseIdle: "Animation pose: idle",
  poseTalkOpen: "Animation pose: talking (mouth open)",
  poseTalkClosed: "Animation pose: talking (mouth closed)",
  poseBlink: "Animation pose: blinking",
};

const generatableViews: CharacterReferenceView[] = [
  "master",
  "front",
  "threeQuarter",
  "side",
  "fullBody",
  "poseIdle",
  "poseTalkOpen",
  "poseTalkClosed",
  "poseBlink",
];

const animationPoseViews = new Set<CharacterReferenceView>([
  "poseIdle",
  "poseTalkOpen",
  "poseTalkClosed",
  "poseBlink",
]);

function sizeForView(view: CharacterReferenceView): "1024x1536" | "1024x1024" {
  if (animationPoseViews.has(view)) return "1024x1024";
  return view === "fullBody" ? "1024x1536" : "1024x1024";
}

function dimensionsForSize(size: "1024x1536" | "1024x1024") {
  return size === "1024x1536"
    ? { width: 1024, height: 1536 }
    : { width: 1024, height: 1024 };
}

export async function loadCharacterPortraitView(input: {
  workspaceId: string;
  character: Character;
}): Promise<CharacterPortraitView> {
  const environment = getSceneImageEnvironment();
  const outputCostMatrix = createSceneImageOutputCostMatrix(environment);
  // Every portrait is generated as an edit anchored to the character's own
  // existing reference images, so the displayed estimate must reserve for
  // however many will actually be attached (see `resolveCharacterReferenceInputs`
  // in the Trigger task), capped the same way the task caps them.
  const existingReferences = await listCharacterReferences({
    workspaceId: input.workspaceId,
    characterId: input.character.id,
  });
  const referenceAssetCount = Math.min(
    existingReferences.length,
    environment.MAX_REFERENCE_ASSETS_PER_GENERATION,
  );
  const views = generatableViews.map((view) => {
    const size = sizeForView(view);
    const prompt = renderCharacterReferencePrompt({
      character: {
        name: input.character.name,
        description: input.character.description,
        visualIdentity: input.character.visualIdentity,
        bodyProportions: input.character.bodyProportions,
        faceDescription: input.character.faceDescription,
        hairDescription: input.character.hairDescription,
        skinToneDescription: input.character.skinToneDescription,
        defaultOutfitDescription: input.character.defaultOutfitDescription,
        negativeConstraints: input.character.negativeConstraints,
      },
      referenceType: view,
      output: dimensionsForSize(size),
    });
    const estimate = estimateSceneImageCost({
      prompt,
      quality: "medium",
      size,
      referenceAssetCount,
      outputCostMatrix,
      textInputCostPerMillionCents:
        environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
      referenceInputReserveCents:
        environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
      safetyMarginBasisPoints: 0,
    });
    return {
      type: view,
      label: viewLabels[view],
      estimatedCostCents: estimate.estimatedCostCents,
    };
  });

  const generations = await listCharacterReferenceGenerations({
    workspaceId: input.workspaceId,
    characterId: input.character.id,
    limit: 8,
  });
  const recent: PortraitGenerationRow[] = generations.map((generation) => ({
    id: generation.id,
    referenceType: generation.referenceType,
    status: generation.status,
    estimatedCostCents: generation.estimatedCostCents,
    actualCostCents: generation.actualCostCents,
    createdAtLabel: `${generation.createdAt
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")} UTC`,
    safeErrorMessage: generation.safeErrorMessage,
  }));

  return {
    enabled: environment.ENABLE_SCENE_IMAGE_GENERATION,
    model: environment.OPENAI_IMAGE_MODEL,
    views,
    recent,
  };
}
