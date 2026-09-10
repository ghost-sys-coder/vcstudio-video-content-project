import "server-only";

import {
  initialiseFinishingSteps,
  recordFinishingStep,
} from "@/db/commands/publication-finishing-commands";
import { findReleasePackage } from "@/db/repositories/release-packages.repository";
import { findThumbnailGeneration } from "@/db/repositories/thumbnail-generation.repository";
import { createThumbnailDownloadUrl } from "@/lib/storage/thumbnail-storage";
import type { VideoFinishingProvider } from "@/lib/publishing/video-finishing-provider";
import {
  describeMissingScope,
  isStepScopeGranted,
  YOUTUBE_FINISHING_STEPS,
  type YouTubeFinishingStep,
} from "@/lib/publishing/youtube-finishing-steps";

/**
 * Finishes a YouTube release after the video itself is up.
 *
 * Every step is attempted independently and its outcome recorded on its own
 * row, which is what allows a thumbnail that failed to attach to be retried
 * without sending the video again. Nothing here throws: the video is already
 * published by this point, and letting a thumbnail failure bubble up would turn
 * a successful upload into a failed publication.
 *
 * A step whose permission is missing is recorded as `unsupported` rather than
 * attempted and failed. That distinction is what stops the interface offering a
 * retry that cannot possibly work, and what makes the external instruction the
 * right thing to show instead.
 */
export async function runYouTubeFinishing(input: {
  workspaceId: string;
  projectId: string;
  publicationId: string;
  releasePackageId: string | null;
  videoId: string;
  accessToken: string;
  grantedScopes: readonly string[];
  provider: VideoFinishingProvider;
  /** The caption track to upload, already serialized. Null when there is none. */
  captions: { language: string; name: string; body: string } | null;
}): Promise<void> {
  const releasePackage = input.releasePackageId
    ? await findReleasePackage({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        releasePackageId: input.releasePackageId,
      })
    : null;

  const wanted: YouTubeFinishingStep[] = [];
  if (releasePackage?.thumbnailGenerationId) wanted.push("thumbnail");
  if (input.captions) wanted.push("captions");
  if (releasePackage?.youtubePlaylistId) wanted.push("playlist");

  // Steps with nothing to do are recorded as skipped rather than omitted, so
  // the release reads as deliberately complete instead of merely silent.
  const skipped = YOUTUBE_FINISHING_STEPS.filter(
    (step) => !wanted.includes(step),
  );

  await initialiseFinishingSteps({
    workspaceId: input.workspaceId,
    publicationId: input.publicationId,
    steps: wanted,
  });

  for (const step of skipped)
    await recordFinishingStep({
      workspaceId: input.workspaceId,
      publicationId: input.publicationId,
      step,
      state: "skipped",
      detail: null,
    });

  for (const step of wanted) {
    if (!isStepScopeGranted({ step, grantedScopes: input.grantedScopes })) {
      await recordFinishingStep({
        workspaceId: input.workspaceId,
        publicationId: input.publicationId,
        step,
        state: "unsupported",
        detail: describeMissingScope(step),
      });
      continue;
    }

    try {
      const outcome = await runStep({ ...input, step, releasePackage });
      await recordFinishingStep({
        workspaceId: input.workspaceId,
        publicationId: input.publicationId,
        step,
        state: outcome.state,
        detail: outcome.detail,
      });
    } catch {
      await recordFinishingStep({
        workspaceId: input.workspaceId,
        publicationId: input.publicationId,
        step,
        state: "failed",
        detail: "This step could not be completed. You can try it again.",
      });
    }
  }
}

async function runStep(input: {
  workspaceId: string;
  projectId: string;
  publicationId: string;
  videoId: string;
  accessToken: string;
  provider: VideoFinishingProvider;
  step: YouTubeFinishingStep;
  captions: { language: string; name: string; body: string } | null;
  releasePackage: {
    thumbnailGenerationId: string | null;
    youtubePlaylistId: string | null;
  } | null;
}) {
  if (input.step === "thumbnail") {
    const thumbnailId = input.releasePackage?.thumbnailGenerationId;
    if (!thumbnailId) return { state: "skipped" as const, detail: null };
    const thumbnail = await findThumbnailGeneration({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      thumbnailGenerationId: thumbnailId,
    });
    if (!thumbnail?.assetObjectKey)
      return {
        state: "failed" as const,
        detail: "The chosen thumbnail no longer has a stored image.",
      };
    return input.provider.setThumbnail({
      accessToken: input.accessToken,
      videoId: input.videoId,
      imageUrl: await createThumbnailDownloadUrl(thumbnail.assetObjectKey),
      contentType:
        thumbnail.outputFormat === "png" ? "image/png" : "image/jpeg",
      sizeBytes: thumbnail.assetSizeBytes ?? 0,
    });
  }

  if (input.step === "captions") {
    if (!input.captions) return { state: "skipped" as const, detail: null };
    return input.provider.insertCaptions({
      accessToken: input.accessToken,
      videoId: input.videoId,
      ...input.captions,
    });
  }

  const playlistId = input.releasePackage?.youtubePlaylistId;
  if (!playlistId) return { state: "skipped" as const, detail: null };
  return input.provider.addToPlaylist({
    accessToken: input.accessToken,
    videoId: input.videoId,
    playlistId,
  });
}
