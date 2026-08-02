import { logger, task, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  markPlatformConnectionUnusable,
  updatePlatformConnectionTokens,
} from "@/db/commands/platform-connection-commands";
import {
  markSocialPostTargetFailed,
  markSocialPostTargetPublished,
  markSocialPostTargetPublishing,
  recordSocialPostTargetOperation,
  reconcileSocialPostStatus,
} from "@/db/commands/social-post-target-commands";
import { findPlatformConnectionWithTokens } from "@/db/repositories/publishing.repository";
import {
  findSocialPost,
  findSocialPostTargetById,
  listSocialPostMedia,
} from "@/db/repositories/social-posts.repository";
import { openSecret, sealSecret } from "@/lib/crypto/secret-box";
import { getPublishingEnvironment } from "@/lib/env/server";
import {
  PublishProviderError,
  type PublishFailure,
} from "@/lib/publishing/video-publish-provider";
import { PlatformNotConfiguredError } from "@/lib/publishing/provider-registry";
import {
  createPlatformOAuthProvider,
  createSocialPostProvider,
} from "@/lib/publishing/social-post-registry";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";

export const socialPostPublishTaskPayloadSchema = z.object({
  targetId: z.uuid(),
  postId: z.uuid(),
  workspaceId: z.uuid(),
});

/** Refresh slightly early so a token cannot expire mid-publish. */
const TOKEN_REFRESH_SKEW_MS = 5 * 60_000;

/**
 * Publishes one post to one connected account.
 *
 * One target per run, so each destination retries independently and a
 * partially-failed post reports honestly. Two safety rules are carried over
 * verbatim from the render publish path, because the failure modes are the same:
 *
 * 1. Retry only when `failure.retriable && !failure.mayHavePublished` —
 *    retrying an ambiguous request posts the same thing twice to a real account.
 * 2. Media URLs are signed for longer than this task's `maxDuration`, because
 *    Meta fetches image URLs itself and a URL that dies mid-job fails the post.
 *
 * The whole body is wrapped: any unexpected throw marks the target failed rather
 * than leaving it spinning in the UI forever.
 */
export const socialPostPublishTask = task({
  id: "social-post-publish",
  queue: { name: "social-publishing", concurrencyLimit: 3 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    factor: 2,
    randomize: true,
  },
  // Must stay below SOCIAL_POST_ASSET_URL_TTL_SECONDS.
  maxDuration: 3000,
  run: async (payload: z.infer<typeof socialPostPublishTaskPayloadSchema>) => {
    const input = socialPostPublishTaskPayloadSchema.parse(payload);

    const settleFailed = async (category: string, message: string) => {
      // Without this the run reports only `status: "failed"` and the reason is
      // reachable solely by querying the database, which is a poor position to
      // debug a live posting failure from.
      logger.error("Social post target failed", {
        targetId: input.targetId,
        postId: input.postId,
        category,
        message,
      });
      await markSocialPostTargetFailed({
        targetId: input.targetId,
        category,
        message,
      });
      await reconcileSocialPostStatus({
        workspaceId: input.workspaceId,
        postId: input.postId,
      });
    };

    try {
      const target = await findSocialPostTargetById(input.targetId);
      if (!target || target.workspaceId !== input.workspaceId)
        throw new Error("Social post target not found.");
      if (target.status === "published" || target.status === "cancelled")
        return { targetId: target.id, status: target.status };

      const post = await findSocialPost({
        workspaceId: input.workspaceId,
        postId: input.postId,
      });
      if (!post) {
        await settleFailed("post_missing", "That post no longer exists.");
        return { targetId: target.id, status: "failed" as const };
      }

      const environment = getPublishingEnvironment();

      const connection = await findPlatformConnectionWithTokens({
        connectionId: target.connectionId,
        workspaceId: input.workspaceId,
      });
      if (!connection || connection.status !== "active") {
        await settleFailed(
          "authorization_expired",
          "The account connection is no longer active. Reconnect it and post again.",
        );
        return { targetId: target.id, status: "failed" as const };
      }

      // Resolve a usable access token, refreshing when it is expired or close to it.
      let accessToken: string;
      try {
        accessToken = openSecret({
          sealed: connection.accessTokenSealed,
          key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
        });
        const expiresAt = connection.accessTokenExpiresAt?.getTime() ?? 0;
        if (expiresAt > 0 && expiresAt - TOKEN_REFRESH_SKEW_MS < Date.now()) {
          if (!connection.refreshTokenSealed)
            throw new PublishProviderError({
              category: "authorization_expired",
              safeMessage:
                "The account authorization expired. Reconnect the account and post again.",
              retriable: false,
              mayHavePublished: false,
            });
          const refreshed = await createPlatformOAuthProvider(
            target.platform,
          ).refreshTokens({
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
        await settleFailed(failure.category, failure.safeMessage);
        return { targetId: target.id, status: "failed" as const };
      }

      await markSocialPostTargetPublishing({ targetId: target.id });

      const media = await listSocialPostMedia({
        workspaceId: input.workspaceId,
        postId: post.id,
      });
      // A file that vanished between dispatch and now would otherwise be signed
      // into a URL that 404s at the platform, which reads as a provider fault.
      const missing = media.find((attachment) => attachment.unavailable);
      if (missing) {
        await settleFailed(
          "asset_unavailable",
          missing.source === "render"
            ? "The attached render is no longer available. Re-render it and post again."
            : "An attached file is no longer available. Re-attach it and post again.",
        );
        return { targetId: target.id, status: "failed" as const };
      }

      // TTL deliberately exceeds this task's maxDuration.
      const resolvedMedia = await Promise.all(
        media.map(async (attachment) => ({
          kind: attachment.kind,
          sourceUrl: await createMediaAssetDownloadUrl(
            attachment.objectKey,
            environment.SOCIAL_POST_ASSET_URL_TTL_SECONDS,
          ),
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          altText: attachment.altText,
          fileName: attachment.originalFileName,
        })),
      );

      const provider = createSocialPostProvider(target.platform);
      const result = await provider.publishPost({
        tokens: { accessToken },
        account: { externalAccountId: connection.externalAccountId },
        // The per-target override wins when someone tailored this platform's
        // copy; otherwise every destination gets the shared body.
        text: target.overrideBodyPlainText ?? post.bodyPlainText,
        media: resolvedMedia,
        providerOperationId: target.providerOperationId,
        providerOperationSecret: target.providerOperationSecretSealed
          ? openSecret({
              sealed: target.providerOperationSecretSealed,
              key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
            })
          : null,
        onProviderOperationCreated: async (
          providerOperationId,
          providerOperationSecret,
        ) => {
          await recordSocialPostTargetOperation({
            targetId: target.id,
            providerOperationId,
            providerOperationSecretSealed: providerOperationSecret
              ? sealSecret({
                  plaintext: providerOperationSecret,
                  key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
                })
              : null,
          });
        },
        waitForProcessing: async (milliseconds) => {
          await wait.for({ seconds: Math.ceil(milliseconds / 1000) });
        },
      });

      await markSocialPostTargetPublished({
        targetId: target.id,
        externalPostId: result.externalPostId,
        externalPostUrl: result.externalPostUrl,
      });
      await reconcileSocialPostStatus({
        workspaceId: input.workspaceId,
        postId: input.postId,
      });
      return { targetId: target.id, status: "published" as const };
    } catch (error) {
      if (error instanceof PublishProviderError) {
        const { failure } = error;
        // Never retry something that may already be live on a real account.
        if (failure.retriable && !failure.mayHavePublished) throw error;
        await settleFailed(failure.category, failure.safeMessage);
        return { targetId: input.targetId, status: "failed" as const };
      }
      if (error instanceof PlatformNotConfiguredError) {
        await settleFailed("not_configured", error.message);
        return { targetId: input.targetId, status: "failed" as const };
      }
      await settleFailed(
        "unexpected_error",
        "This destination could not be posted to. Try again.",
      );
      return { targetId: input.targetId, status: "failed" as const };
    }
  },
});
