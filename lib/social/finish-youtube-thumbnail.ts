import "server-only";
import type { SocialPostTarget } from "@/db/schema";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { recordSocialYouTubeThumbnail } from "@/db/commands/social-post-target-commands";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import type { VideoFinishingProvider } from "@/lib/publishing/video-finishing-provider";
import { youTubeThumbnailProblem } from "./youtube-post-settings";

/** Finishing touches only an existing video; it never invokes an upload. */
export async function finishSocialYouTubeThumbnail(input: {
  target: SocialPostTarget;
  videoId: string;
  accessToken: string;
  provider: VideoFinishingProvider;
  waitForProcessing: (milliseconds: number) => Promise<void>;
}) {
  const { target } = input;
  if (
    !target.youtubeThumbnailAssetId ||
    target.youtubeThumbnailStatus === "succeeded"
  )
    return;
  let outcome;
  try {
    const [asset] = await findReadyMediaAssets({
      workspaceId: target.workspaceId,
      mediaAssetIds: [target.youtubeThumbnailAssetId],
    });
    const problem = youTubeThumbnailProblem(asset);
    if (problem || !asset)
      outcome = {
        state: "failed" as const,
        detail: problem ?? "The selected thumbnail is unavailable.",
      };
    else
      outcome = await input.provider.setThumbnail({
        accessToken: input.accessToken,
        videoId: input.videoId,
        imageUrl: await createMediaAssetDownloadUrl(asset.objectKey, 600),
        contentType: asset.contentType,
        sizeBytes: asset.sizeBytes,
        waitForProcessing: input.waitForProcessing,
      });
  } catch {
    outcome = {
      state: "failed" as const,
      detail:
        "The video was uploaded, but its thumbnail could not be finished. Retry the thumbnail only.",
    };
  }
  await recordSocialYouTubeThumbnail({
    workspaceId: target.workspaceId,
    targetId: target.id,
    state: outcome.state === "skipped" ? "failed" : outcome.state,
    detail: outcome.detail,
  });
}
