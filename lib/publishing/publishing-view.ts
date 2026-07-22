import "server-only";

import type { ContentPlatform, Project, VideoPublication } from "@/db/schema";
import {
  listPlatformConnections,
  listProjectVideoPublications,
} from "@/db/repositories/publishing.repository";
import { listVideoRenders } from "@/db/repositories/video-render.repository";
import { getPublishingEnvironment } from "@/lib/env/server";
import { PUBLISHABLE_PLATFORMS } from "@/lib/publishing/provider-registry";
import { validateTikTokUploadAsset } from "@/lib/publishing/tiktok-upload-validation";
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
  label: string;
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
  const [connections, renders, publications] = await Promise.all([
    listPlatformConnections({ workspaceId: input.workspaceId }),
    listVideoRenders({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      limit: PUBLISHABLE_RENDER_LIMIT,
    }),
    listProjectVideoPublications({
      workspaceId: input.workspaceId,
      projectId: input.project.id,
      limit: PUBLICATION_HISTORY_LIMIT,
    }),
  ]);

  return {
    enabled: environment.ENABLE_VIDEO_PUBLISHING,
    publishablePlatforms: PUBLISHABLE_PLATFORMS.map((platform) => ({
      platform,
      label: CONTENT_PLATFORM_LABELS[platform],
    })),
    maxVideoBytes: environment.MAX_PUBLISH_VIDEO_BYTES,
    connections: connections.map((connection) => ({
      id: connection.id,
      platform: connection.platform,
      platformLabel: CONTENT_PLATFORM_LABELS[connection.platform],
      accountName: connection.externalAccountName,
      accountUrl: connection.externalAccountUrl,
      status: connection.status,
      lastError: connection.lastError,
    })),
    // Only finished renders with a stored asset can be published.
    renders: renders
      .filter(
        (render) =>
          render.status === "succeeded" &&
          render.assetObjectKey !== null &&
          (render.assetSizeBytes ?? 0) > 0,
      )
      .map((render) => {
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
          label: `${render.width}×${render.height} · ${Math.round(
            render.durationMilliseconds / 1000,
          )}s · ${formatUtc(render.createdAt)}`,
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
      }),
    publications: publications.map((publication) => ({
      id: publication.id,
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
