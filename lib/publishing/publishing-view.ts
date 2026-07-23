import "server-only";

import type {
  ContentPlatform,
  Project,
  TitleGenerationRun,
  VideoPublication,
} from "@/db/schema";
import {
  listPlatformConnections,
  listProjectVideoPublications,
} from "@/db/repositories/publishing.repository";
import { listRendersWithSource } from "@/db/repositories/video-render.repository";
import {
  findLatestCompletedTitleGenerationRunForPlatform,
  listTitleSuggestionsForRuns,
} from "@/db/repositories/title-generation.repository";
import { getPublishingEnvironment } from "@/lib/env/server";
import { PUBLISHABLE_PLATFORMS } from "@/lib/publishing/provider-registry";
import {
  buildRenderOptionLabel,
  classifyRenderSource,
  formatRenderClock,
  RENDER_KIND_ORDER,
  type PublishableRenderKind,
} from "@/lib/publishing/render-source-label";
import { validateTikTokUploadAsset } from "@/lib/publishing/tiktok-upload-validation";
import {
  normalizeGeneratedTags,
  selectPreferredGeneratedTitle,
  type GeneratedPublishingMetadata,
} from "@/lib/publishing/generated-metadata";
import { CONTENT_PLATFORM_LABELS } from "@/lib/titles/title-view";

export const PUBLICATION_HISTORY_LIMIT = 20;
export const PUBLISHABLE_RENDER_LIMIT = 20;

export type ConnectionView = {
  id: string;
  platform: ContentPlatform;
  platformLabel: string;
  accountName: string;
  accountUrl: string | null;
  status: "active" | "expired" | "revoked";
  lastError: string | null;
};

export type PublishableRenderView = {
  id: string;
  /** Concise one-line label including kind + source name (used by the closed picker). */
  label: string;
  /** short | variant | longform — drives grouping and the icon in the picker. */
  kind: PublishableRenderKind;
  /** Section heading for grouping, e.g. "Shorts". */
  groupLabel: string;
  /** The short/variant name, or null for a full-length export. */
  sourceName: string | null;
  dimensionsLabel: string;
  clockLabel: string;
  sizeBytes: number;
  durationSeconds: number;
  createdAtLabel: string;
  tooLarge: boolean;
  instagramEligible: boolean;
  instagramIneligibilityReason: string | null;
  tiktokEligible: boolean;
  tiktokIneligibilityReason: string | null;
};

export type PublicationView = {
  id: string;
  connectionId: string;
  renderId: string;
  platform: ContentPlatform;
  platformLabel: string;
  title: string;
  status: VideoPublication["status"];
  visibility: VideoPublication["visibility"];
  progressPercent: number;
  externalVideoUrl: string | null;
  safeErrorMessage: string | null;
  providerOperationStage: string | null;
  createdAtLabel: string;
};

export type PublishingView = {
  enabled: boolean;
  /** Platforms that can actually be published to today. */
  publishablePlatforms: { platform: ContentPlatform; label: string }[];
  connections: ConnectionView[];
  renders: PublishableRenderView[];
  publications: PublicationView[];
  generatedMetadata: GeneratedPublishingMetadata[];
  maxVideoBytes: number;
};

export type PublishActionResult = { success: boolean; error: string | null };

function formatUtc(value: Date): string {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export async function loadPublishingView(input: {
  workspaceId: string;
  project: Project;
}): Promise<PublishingView> {
  const environment = getPublishingEnvironment();
  const [connections, renders, publications, metadataRuns] = await Promise.all([
    listPlatformConnections({ workspaceId: input.workspaceId }),
    listRendersWithSource({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      limit: PUBLISHABLE_RENDER_LIMIT,
    }),
    listProjectVideoPublications({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      limit: PUBLICATION_HISTORY_LIMIT,
    }),
    Promise.all(
      PUBLISHABLE_PLATFORMS.map((platform) =>
        findLatestCompletedTitleGenerationRunForPlatform({
          workspaceId: input.workspaceId,
          projectId: input.project.id,
          platform,
        }),
      ),
    ),
  ]);
  const completeMetadataRuns = metadataRuns.filter(
    (run): run is TitleGenerationRun =>
      run !== null &&
      run.generatedDescription !== null &&
      run.generatedTags !== null,
  );
  const metadataSuggestions = await listTitleSuggestionsForRuns({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    titleGenerationRunIds: completeMetadataRuns.map((run) => run.id),
  });

  return {
    enabled: environment.ENABLE_VIDEO_PUBLISHING,
    publishablePlatforms: PUBLISHABLE_PLATFORMS.map((platform) => ({
      platform,
      label: CONTENT_PLATFORM_LABELS[platform],
    })),
    maxVideoBytes: environment.MAX_PUBLISH_VIDEO_BYTES,
    generatedMetadata: completeMetadataRuns.map((run) => ({
      generationRunId: run.id,
      platform: run.platform,
      title: selectPreferredGeneratedTitle(
        metadataSuggestions.filter(
          (suggestion) => suggestion.titleGenerationRunId === run.id,
        ),
      ),
      description: run.generatedDescription ?? "",
      tags: normalizeGeneratedTags(run.generatedTags ?? []),
    })),
    connections: connections.map((connection) => ({
      id: connection.id,
      platform: connection.platform,
      platformLabel: CONTENT_PLATFORM_LABELS[connection.platform],
      accountName: connection.externalAccountName,
      accountUrl: connection.externalAccountUrl,
      status: connection.status,
      lastError: connection.lastError,
    })),
    // Only finished renders with a stored asset can be published. Shorts and
    // repurposed variants surface here alongside the full-length export, each
    // tagged with its kind and source name so a user can tell them apart —
    // grouped shorts first, then variants, then full video, newest within each.
    renders: renders
      .filter(
        (render) =>
          render.status === "succeeded" &&
          render.assetObjectKey !== null &&
          (render.assetSizeBytes ?? 0) > 0,
      )
      .map((render) => {
        const source = classifyRenderSource({
          shortName: render.shortName,
          variantName: render.variantName,
        });
        const tiktokValidation = validateTikTokUploadAsset({
          width: render.width,
          height: render.height,
          framesPerSecond: render.framesPerSecond,
          durationMilliseconds: render.durationMilliseconds,
          sizeBytes: render.assetSizeBytes ?? 0,
          contentType: render.assetContentType,
        });
        return {
          id: render.id,
          kind: source.kind,
          groupLabel: source.groupLabel,
          sourceName: source.sourceName,
          dimensionsLabel: `${render.width}×${render.height}`,
          clockLabel: formatRenderClock(render.durationMilliseconds),
          label: buildRenderOptionLabel({
            kind: source.kind,
            sourceName: source.sourceName,
            width: render.width,
            height: render.height,
            durationMilliseconds: render.durationMilliseconds,
          }),
          sizeBytes: render.assetSizeBytes ?? 0,
          durationSeconds: Math.round(render.durationMilliseconds / 1000),
          createdAtLabel: formatUtc(render.createdAt),
          tooLarge:
            (render.assetSizeBytes ?? 0) > environment.MAX_PUBLISH_VIDEO_BYTES,
          instagramEligible:
            render.width * 16 === render.height * 9 &&
            render.framesPerSecond >= 23 &&
            render.framesPerSecond <= 60 &&
            render.durationMilliseconds >= 3000 &&
            render.durationMilliseconds <= 900_000 &&
            (render.assetSizeBytes ?? 0) <= 1_073_741_824 &&
            render.width <= 1920 &&
            render.assetContentType === "video/mp4",
          instagramIneligibilityReason:
            render.width * 16 !== render.height * 9
              ? "Instagram requires a vertical 9:16 render."
              : render.framesPerSecond < 23 || render.framesPerSecond > 60
                ? "Instagram requires 23–60 FPS."
                : render.durationMilliseconds < 3000 ||
                    render.durationMilliseconds > 900_000
                  ? "Instagram Reels must be 3 seconds to 15 minutes."
                  : (render.assetSizeBytes ?? 0) > 1_073_741_824
                    ? "Instagram Reels cannot exceed 1 GB."
                    : render.width > 1920
                      ? "Instagram cannot accept more than 1920 horizontal pixels."
                      : render.assetContentType !== "video/mp4"
                        ? "Instagram requires an MP4 render."
                        : null,
          tiktokEligible: tiktokValidation.eligible,
          tiktokIneligibilityReason: tiktokValidation.reason,
        };
      })
      // Stable sort keeps the query's newest-first order within each kind.
      .sort(
        (left, right) =>
          RENDER_KIND_ORDER[left.kind] - RENDER_KIND_ORDER[right.kind],
      ),
    publications: publications.map((publication) => ({
      id: publication.id,
      connectionId: publication.connectionId,
      renderId: publication.renderId,
      platform: publication.platform,
      platformLabel: CONTENT_PLATFORM_LABELS[publication.platform],
      title: publication.title,
      status: publication.status,
      visibility: publication.visibility,
      progressPercent: publication.progressPercent,
      externalVideoUrl: publication.externalVideoUrl,
      safeErrorMessage: publication.safeErrorMessage,
      providerOperationStage: publication.providerOperationStage,
      createdAtLabel: formatUtc(publication.createdAt),
    })),
  };
}
