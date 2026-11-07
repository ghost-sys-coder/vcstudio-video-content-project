import "server-only";
import {
  findVideoPublication,
  findPlatformConnectionWithTokens,
} from "@/db/repositories/publishing.repository";
import { recordFinishingStep } from "@/db/commands/publication-finishing-commands";
import { updatePlatformConnectionTokens } from "@/db/commands/platform-connection-commands";
import { createVideoPublishProvider } from "./provider-registry";
import { supportsFinishing } from "./video-finishing-provider";
import { runYouTubeFinishing } from "./run-youtube-finishing";
import { getPublishingEnvironment } from "@/lib/env/server";
import { openSecret } from "@/lib/crypto/secret-box";

/** This branch deliberately has no call to publishVideo. */
export async function finishProjectYouTubeThumbnail(
  input: { workspaceId: string; projectId: string; publicationId: string },
  waitForProcessing: (milliseconds: number) => Promise<void>,
) {
  const publication = await findVideoPublication(input);
  if (
    !publication ||
    publication.platform !== "youtube" ||
    publication.status !== "succeeded" ||
    !publication.externalVideoId ||
    !publication.releasePackageId
  )
    return { publicationId: input.publicationId, status: "unavailable" };
  try {
    const environment = getPublishingEnvironment();
    if (!environment.ENABLE_VIDEO_PUBLISHING)
      throw new Error("Publishing is paused.");
    const connection = await findPlatformConnectionWithTokens({
      workspaceId: input.workspaceId,
      connectionId: publication.connectionId,
    });
    if (!connection || connection.status !== "active")
      throw new Error(
        "Reconnect the YouTube channel before retrying the thumbnail.",
      );
    const provider = createVideoPublishProvider("youtube", connection);
    if (!supportsFinishing(provider))
      throw new Error("Thumbnail finishing is unavailable.");
    let accessToken = openSecret({
      sealed: connection.accessTokenSealed,
      key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
    });
    if (
      connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() < Date.now() + 300000
    ) {
      if (!connection.refreshTokenSealed)
        throw new Error(
          "Reconnect the YouTube channel before retrying the thumbnail.",
        );
      const tokens = await provider.refreshTokens({
        refreshToken: openSecret({
          sealed: connection.refreshTokenSealed,
          key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
        }),
      });
      await updatePlatformConnectionTokens({
        workspaceId: input.workspaceId,
        connectionId: connection.id,
        tokens: { ...tokens, refreshToken: tokens.refreshToken ?? null },
      });
      accessToken = tokens.accessToken;
    }
    await runYouTubeFinishing({
      ...input,
      releasePackageId: publication.releasePackageId,
      videoId: publication.externalVideoId,
      accessToken,
      grantedScopes: connection.scopes?.split(" ").filter(Boolean) ?? [],
      provider,
      captions: null,
      onlyStep: "thumbnail",
      waitForProcessing,
    });
    return { publicationId: publication.id, status: "finished" };
  } catch {
    await recordFinishingStep({
      workspaceId: input.workspaceId,
      publicationId: publication.id,
      step: "thumbnail",
      state: "failed",
      detail:
        "The thumbnail could not be finished. Reconnect the channel if necessary, then retry the thumbnail only. The video is already uploaded.",
    });
    return { publicationId: publication.id, status: "thumbnail_failed" };
  }
}
