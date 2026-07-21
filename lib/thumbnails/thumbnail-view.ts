import "server-only";

import {
  renderThumbnailPrompt,
  THUMBNAIL_PROMPT_VERSION,
} from "@studio/prompts";
import type {
  ContentPlatform,
  Project,
  ProjectBrief,
  ThumbnailGeneration,
} from "@/db/schema";
import { contentPlatformEnum } from "@/db/schema";
import { findApprovedScriptVersion } from "@/db/repositories/scenes.repository";
import { listProjectThumbnails } from "@/db/repositories/thumbnail-generation.repository";
import { listProjectTitleSuggestions } from "@/db/repositories/title-generation.repository";
import { buildHeadlineOptions } from "@/lib/thumbnails/headline-options";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { getSceneImageDimensions } from "@/lib/schemas/scene-image";
import { getThumbnailSizeForPlatform } from "@/lib/schemas/thumbnail";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import { CONTENT_PLATFORM_LABELS } from "@/lib/titles/title-view";

export const THUMBNAIL_GALLERY_LIMIT = 12;

export type ThumbnailView = {
  id: string;
  status: ThumbnailGeneration["status"];
  platform: ContentPlatform;
  textMode: ThumbnailGeneration["textMode"];
  headlineText: string | null;
  width: number | null;
  height: number | null;
  isFavorite: boolean;
  estimatedCostCents: number;
  actualCostCents: number | null;
  errorCategory: string | null;
  safeErrorMessage: string | null;
  hasAsset: boolean;
  createdAtLabel: string;
};

export type PlatformThumbnailsView = {
  platform: ContentPlatform;
  label: string;
  size: string;
  estimatedCostCents: number;
  /** Suggested baked-in headlines, condensed from this platform's titles and the brief. */
  headlineOptions: string[];
  thumbnails: ThumbnailView[];
};

export type ThumbnailsView = {
  model: string;
  promptVersion: string;
  hasContext: boolean;
  generationEnabled: boolean;
  platforms: PlatformThumbnailsView[];
};

export type ThumbnailActionResult = {
  success: boolean;
  error: string | null;
};

function toThumbnailView(generation: ThumbnailGeneration): ThumbnailView {
  return {
    id: generation.id,
    status: generation.status,
    platform: generation.platform,
    textMode: generation.textMode,
    headlineText: generation.headlineText,
    width: generation.assetWidth,
    height: generation.assetHeight,
    isFavorite: generation.isFavorite,
    estimatedCostCents: generation.estimatedCostCents,
    actualCostCents: generation.actualCostCents,
    errorCategory: generation.errorCategory,
    safeErrorMessage: generation.safeErrorMessage,
    hasAsset: generation.assetObjectKey !== null,
    createdAtLabel: `${generation.createdAt
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")} UTC`,
  };
}

export async function loadThumbnailsView(input: {
  workspaceId: string;
  project: Project;
  brief: ProjectBrief | null;
}): Promise<ThumbnailsView> {
  const environment = getSceneImageEnvironment();
  const outputCostMatrix = createSceneImageOutputCostMatrix(environment);
  const quality = environment.OPENAI_IMAGE_FINAL_QUALITY;

  const [approvedScript, titleSuggestions, thumbnailsByPlatform] =
    await Promise.all([
      findApprovedScriptVersion({
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      }),
      listProjectTitleSuggestions({
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      }),
      Promise.all(
        contentPlatformEnum.enumValues.map((platform) =>
          listProjectThumbnails({
            workspaceId: input.workspaceId,
            projectId: input.project.id,
            platform,
            limit: THUMBNAIL_GALLERY_LIMIT,
          }),
        ),
      ),
    ]);

  const hasTopic = Boolean(input.brief && input.brief.topic.trim() !== "");
  const hasContext = hasTopic || approvedScript !== null;

  const platforms: PlatformThumbnailsView[] =
    contentPlatformEnum.enumValues.map((platform, index) => {
      const size = getThumbnailSizeForPlatform(platform);
      // Estimate against the text-free variant: the two modes differ by a few
      // prompt tokens, and the output cost (which dominates) is identical.
      const prompt = renderThumbnailPrompt({
        platform,
        topic: input.brief?.topic ?? "",
        targetAudience: input.brief?.targetAudience ?? "",
        tone: input.brief?.tone ?? "",
        hookAngle: input.brief?.hookAngle ?? "",
        title: null,
        scriptExcerpt: approvedScript?.content ?? null,
        textMode: "clean",
        headlineText: null,
        output: getSceneImageDimensions(size),
      });
      const estimatedCostCents = estimateSceneImageCost({
        prompt,
        quality,
        size,
        referenceAssetCount: 0,
        outputCostMatrix,
        textInputCostPerMillionCents:
          environment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
        referenceInputReserveCents:
          environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
        safetyMarginBasisPoints: 0,
      }).estimatedCostCents;

      // Favorited titles first — a starred title is the user's own signal about
      // which hook they trust, so it should lead the headline suggestions.
      const platformTitles = titleSuggestions
        .filter((suggestion) => suggestion.platform === platform)
        .sort(
          (left, right) =>
            Number(right.isFavorite) - Number(left.isFavorite) ||
            left.position - right.position,
        )
        .map((suggestion) => suggestion.text);

      return {
        platform,
        label: CONTENT_PLATFORM_LABELS[platform],
        size,
        estimatedCostCents,
        headlineOptions: buildHeadlineOptions({
          titles: platformTitles,
          hookAngle: input.brief?.hookAngle ?? "",
          topic: input.brief?.topic ?? "",
        }),
        thumbnails: (thumbnailsByPlatform[index] ?? []).map(toThumbnailView),
      };
    });

  return {
    model: environment.OPENAI_IMAGE_MODEL,
    promptVersion: THUMBNAIL_PROMPT_VERSION,
    hasContext,
    generationEnabled: environment.ENABLE_SCENE_IMAGE_GENERATION,
    platforms,
  };
}
