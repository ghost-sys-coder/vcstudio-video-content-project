import { task, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import { markPlatformConnectionUnusable } from "@/db/commands/platform-connection-commands";
import { updatePlatformConnectionTokens } from "@/db/commands/platform-connection-commands";
import {
  completeVideoPublication,
  failVideoPublication,
  markVideoPublicationUploading,
  markVideoPublicationProcessing,
  updateVideoPublicationProgress,
  updateVideoPublicationProcessingProgress,
} from "@/db/commands/video-publication-commands";
import {
  findPlatformConnectionWithTokens,
  findVideoPublicationById,
} from "@/db/repositories/publishing.repository";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import { openSecret } from "@/lib/crypto/secret-box";
import { getPublishingEnvironment } from "@/lib/env/server";
import {
  PublishProviderError,
  type PublishFailure,
} from "@/lib/publishing/video-publish-provider";
import { createVideoPublishProvider } from "@/lib/publishing/provider-registry";
import { createVideoExportDownloadUrl } from "@/lib/storage/video-export-storage";

export const videoPublishTaskPayloadSchema = z.object({
  publicationId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

/** Refresh slightly early so a token cannot expire mid-upload. */
const TOKEN_REFRESH_SKEW_MS = 5 * 60_000;

export const videoPublishTask = task({
  id: "video-publish",
  queue: { name: "video-publishing", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    factor: 2,
    randomize: true,
  },
  // Must stay below PUBLISH_ASSET_URL_TTL_SECONDS, or the signed source URL
  // expires while bytes are still streaming — the failure mode that previously
  // stalled long renders.
  maxDuration: 3000,
  run: async (
    payload: z.infer<typeof videoPublishTaskPayloadSchema>,
    { ctx },
  ) => {
    const input = videoPublishTaskPayloadSchema.parse(payload);
    const publication = await findVideoPublicationById(input.publicationId);
    if (!publication) throw new Error("Video publication not found.");
    if (
      publication.status === "succeeded" ||
      publication.status === "failed" ||
      publication.status === "cancelled"
    )
      return { publicationId: publication.id, status: publication.status };

    const environment = getPublishingEnvironment();
    const scope = {
      publicationId: publication.id,
      workspaceId: input.workspaceId,
    };

    const render = await findVideoRender({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      renderId: publication.renderId,
    });
    if (
      !render ||
      render.status !== "succeeded" ||
      !render.assetObjectKey ||
      !render.assetSizeBytes
    ) {
      await failVideoPublication({
        ...scope,
        category: "asset_unavailable",
        message: "The rendered video is no longer available.",
      });
      return { publicationId: publication.id, status: "failed" as const };
    }

    const connection = await findPlatformConnectionWithTokens({
      connectionId: publication.connectionId,
      workspaceId: input.workspaceId,
    });
    if (!connection || connection.status !== "active") {
      await failVideoPublication({
        ...scope,
        category: "authorization_expired",
        message:
          "The account connection is no longer active. Reconnect it and publish again.",
      });
      return { publicationId: publication.id, status: "failed" as const };
    }

    const provider = createVideoPublishProvider(publication.platform);

    // Resolve a usable access token, refreshing when it is expired or close to it.
    let accessToken: string;
    try {
      accessToken = openSecret({
        sealed: connection.accessTokenSealed,
        key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
      });
      const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
      const needsRefresh =
        expiresAt > 0 && expiresAt - TOKEN_REFRESH_SKEW_MS < Date.now();
      if (needsRefresh) {
        if (!connection.refreshTokenSealed)
          throw new PublishProviderError({
            category: "authorization_expired",
            safeMessage:
              "The account authorization expired. Reconnect the account and publish again.",
            retriable: false,
            mayHavePublished: false,
          });
        const refreshed = await provider.refreshTokens({
          refreshToken: openSecret({
            sealed: connection.refreshTokenSealed,
            key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
          }),
        });
        await updatePlatformConnectionTokens({
          connectionId: connection.id,
          workspaceId: input.workspaceId,
          tokens: {
            ...refreshed,
            refreshToken: refreshed.refreshToken ?? null,
          },
        });
        accessToken = refreshed.accessToken;
      }
    } catch (error) {
      const failure: PublishFailure =
        error instanceof PublishProviderError
          ? error.failure
          : {
              category: "authorization_expired",
              safeMessage:
                "The stored authorization could not be used. Reconnect the account.",
              retriable: false,
              mayHavePublished: false,
            };
      await markPlatformConnectionUnusable({
        connectionId: connection.id,
        workspaceId: input.workspaceId,
        status: "expired",
        safeError: failure.safeMessage,
      });
      await failVideoPublication({
        ...scope,
        category: failure.category,
        message: failure.safeMessage,
      });
      return { publicationId: publication.id, status: "failed" as const };
    }

    await markVideoPublicationUploading({
      publicationId: publication.id,
      attemptCount: ctx.attempt.number,
    });
    if (publication.providerOperationId)
      await markVideoPublicationProcessing({
        publicationId: publication.id,
        providerOperationId: publication.providerOperationId,
      });

    // TTL deliberately exceeds this task's maxDuration.
    const sourceUrl = await createVideoExportDownloadUrl(
      render.assetObjectKey,
      environment.PUBLISH_ASSET_URL_TTL_SECONDS,
    );

    try {
      const result = await provider.publishVideo({
        tokens: { accessToken },
        account: { externalAccountId: connection.externalAccountId },
        sourceUrl,
        sizeBytes: render.assetSizeBytes,
        contentType: render.assetContentType ?? "video/mp4",
        title: publication.title,
        description: publication.description,
        tags: publication.tags,
        visibility: publication.visibility,
        caption: publication.caption,
        shareToFeed: publication.shareToFeed,
        providerOperationId: publication.providerOperationId,
        onProviderOperationCreated: async (providerOperationId) => {
          await markVideoPublicationProcessing({
            publicationId: publication.id,
            providerOperationId,
          });
        },
        onProcessingProgress: async (percent) => {
          await updateVideoPublicationProcessingProgress({
            publicationId: publication.id,
            progressPercent: percent,
          });
        },
        waitForProcessing: async (milliseconds) => {
          await wait.for({
            seconds: Math.max(1, Math.ceil(milliseconds / 1000)),
          });
        },
        onProgress: async (percent) => {
          await updateVideoPublicationProgress({
            publicationId: publication.id,
            progressPercent: percent,
            uploadedBytes: Math.floor(
              ((render.assetSizeBytes ?? 0) * percent) / 100,
            ),
          });
        },
      });

      await completeVideoPublication({
        publicationId: publication.id,
        externalVideoId: result.externalVideoId,
        externalVideoUrl: result.externalVideoUrl,
        uploadedBytes: result.uploadedBytes,
      });
      return { publicationId: publication.id, status: "succeeded" as const };
    } catch (error) {
      const failure: PublishFailure =
        error instanceof PublishProviderError
          ? error.failure
          : {
              category: "provider_error",
              safeMessage: "The video could not be published.",
              retriable: false,
              mayHavePublished: false,
            };

      if (failure.category === "authorization_expired")
        await markPlatformConnectionUnusable({
          connectionId: connection.id,
          workspaceId: input.workspaceId,
          status: "expired",
          safeError: failure.safeMessage,
        });

      // Only retry when the platform is confidently retriable AND the upload
      // cannot already have created a video — re-running an ambiguous upload
      // would publish the same video twice to a real channel.
      const canRetry =
        failure.retriable &&
        !failure.mayHavePublished &&
        ctx.attempt.number < (ctx.run.maxAttempts ?? 3);
      if (canRetry) throw error;

      await failVideoPublication({
        ...scope,
        category: failure.category,
        message: failure.safeMessage,
      });
      return { publicationId: publication.id, status: "failed" as const };
    }
  },
});
