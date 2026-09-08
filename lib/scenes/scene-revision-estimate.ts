import "server-only";

import type { Project } from "@/db/schema";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import {
  listApprovedSceneImageAssets,
  listApprovedSceneAudioAssets,
} from "@/db/repositories/subtitle.repository";
import {
  findSceneImageGeneration,
  findStylePresetVersion,
  listAssignedSceneCharacters,
  listGenerationReferenceAssets,
  findEligibleSceneReferenceAssetsByIds,
} from "@/db/repositories/scene-images.repository";
import { findSceneAudioGeneration } from "@/db/repositories/scene-audio.repository";
import {
  SceneRevisionConflictError,
  sceneMediaCompatibility,
} from "@/lib/domain/scene-revision";
import {
  getSceneImageEnvironment,
  getSceneAudioEnvironment,
} from "@/lib/env/server";
import { createSceneImageOutputCostMatrix } from "./scene-image-configuration";
import {
  createSceneImagePromptPreview,
  sceneImagePromptModeForVideoKind,
} from "./scene-image-prompt";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import { estimateSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";
import { buildSceneNarrationInput } from "@/lib/audio/narration-input";
import {
  SCENE_IMAGE_API_SIZES,
  sceneImageApiSizeSchema,
  getAspectRatioForSceneImageSize,
} from "@/lib/schemas/scene-image";
import { updateSceneSchema } from "@/lib/schemas/scene";
import { formatUsdCents } from "@/lib/format/currency";
import type { SceneRevisionEstimateView } from "./scene-revision-view";

/** Read-only planning estimate. It never reserves budget, generates media or edits a scene. */
export async function estimateSceneRevision(input: {
  workspaceId: string;
  project: Pick<Project, "id" | "videoKind">;
  revision: unknown;
}): Promise<SceneRevisionEstimateView> {
  const revision = updateSceneSchema.parse(input.revision);
  if (revision.projectId !== input.project.id)
    throw new SceneRevisionConflictError();
  const scope = { workspaceId: input.workspaceId, projectId: input.project.id };
  const current = await findCurrentScene({
    ...scope,
    sceneId: revision.sceneId,
  });
  if (!current || current.scene.currentVersion !== revision.expectedVersion)
    throw new SceneRevisionConflictError();
  const compatibility = sceneMediaCompatibility(current.version, revision);
  const mediaScope = { ...scope, sceneVersionIds: [current.version.id] };
  const [images, audio] = await Promise.all([
    Promise.all(
      SCENE_IMAGE_API_SIZES.map((size) =>
        listApprovedSceneImageAssets({ ...mediaScope, size }),
      ),
    ).then((rows) => rows.flat()),
    listApprovedSceneAudioAssets(mediaScope),
  ]);
  const lines: string[] = [];
  let estimatedCostCents = 0;
  let unavailableCount = 0;
  for (const image of images) {
    if (compatibility.image) continue;
    const generation = await findSceneImageGeneration({
      ...scope,
      generationId: image.generationId,
    });
    if (!generation) throw new SceneRevisionConflictError();
    if (generation.source === "user_uploaded") {
      lines.push(
        `Image ${generation.size}: upload or choose a replacement; external acquisition costs are not estimated.`,
      );
      unavailableCount++;
      continue;
    }
    const size = sceneImageApiSizeSchema.parse(generation.size);
    const [style, assigned, storedReferences] = await Promise.all([
      generation.stylePresetVersionId
        ? findStylePresetVersion({
            workspaceId: input.workspaceId,
            stylePresetVersionId: generation.stylePresetVersionId,
          })
        : null,
      listAssignedSceneCharacters({
        ...scope,
        sceneVersionId: current.version.id,
      }),
      listGenerationReferenceAssets({ ...scope, generationId: generation.id }),
    ]);
    const referenceIds = storedReferences.map(
      ({ reference }) => reference.referenceAssetIdSnapshot,
    );
    const references = referenceIds.length
      ? await findEligibleSceneReferenceAssetsByIds({
          ...scope,
          sceneVersionId: current.version.id,
          referenceAssetIds: referenceIds,
        })
      : [];
    if (
      !style ||
      !generation.quality ||
      references.length !== referenceIds.length
    ) {
      lines.push(
        `Image ${size}: estimate unavailable; choose an available style and references when generating.`,
      );
      unavailableCount++;
      continue;
    }
    const environment = getSceneImageEnvironment();
    const prompt = createSceneImagePromptPreview({
      sceneVersion: { ...current.version, ...revision },
      size,
      aspectRatio: getAspectRatioForSceneImageSize(size),
      mode: sceneImagePromptModeForVideoKind(input.project.videoKind),
      stylePreset: {
        ...style.version,
        id: style.preset.id,
        versionId: style.version.id,
        isDefault: style.preset.isDefault,
      },
      characters: assigned.map(({ character }) => character),
      references: references.map(({ character, reference }) => ({
        id: reference.id,
        characterId: character.id,
        characterName: character.name,
        typeLabel: reference.type,
        referenceType: reference.type,
        thumbnailUrl: "",
        width: reference.width,
        height: reference.height,
      })),
    });
    const estimate = estimateSceneImageCost({
      prompt,
      quality: generation.quality,
      size,
      referenceAssetCount: references.length,
      outputCostMatrix: createSceneImageOutputCostMatrix(environment),
      textInputCostPerMillionCents:
        environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
      referenceInputReserveCents:
        environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
      safetyMarginBasisPoints: 0,
    });
    estimatedCostCents += estimate.estimatedCostCents;
    lines.push(
      `Image ${size}: ${formatUsdCents(estimate.estimatedCostCents)} using ${generation.quality} quality, ${style.version.name}, the same references and current ${environment.OPENAI_IMAGE_MODEL} rates.`,
    );
  }
  if (!compatibility.audio && audio[0]) {
    const generation = await findSceneAudioGeneration({
      ...scope,
      generationId: audio[0].generationId,
    });
    if (!generation) throw new SceneRevisionConflictError();
    if (generation.source !== "ai_generated") {
      lines.push(
        "Narration: record or upload a replacement; recording costs are not estimated.",
      );
      unavailableCount++;
    } else {
      const environment = getSceneAudioEnvironment();
      if (
        revision.narrationText.replace(/\s+/g, " ").trim().length >
        environment.MAX_NARRATION_CHARACTERS
      ) {
        lines.push(
          "Narration exceeds the speech generation limit. Shorten or split it before generating.",
        );
        unavailableCount++;
      } else {
        const narration = buildSceneNarrationInput({
          narrationText: revision.narrationText,
          maximumCharacters: environment.MAX_NARRATION_CHARACTERS,
        });
        const cents = estimateSceneAudioCostCents({
          characterCount: narration.characterCount,
          rates: {
            costPerMillionCharactersCents:
              environment.OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS,
            minimumEstimateCents: environment.OPENAI_TTS_MINIMUM_ESTIMATE_CENTS,
          },
        });
        estimatedCostCents += cents;
        lines.push(
          `Narration: ${formatUsdCents(cents)} for ${narration.characterCount} characters at current speech rates.`,
        );
      }
    }
  }
  if (!lines.length)
    lines.push(
      "No approved image or narration needs replacement for this edit.",
    );
  return { lines, estimatedCostCents, unavailableCount };
}
