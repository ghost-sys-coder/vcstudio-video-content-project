import "server-only";
import type { SocialYouTubeSettings } from "@studio/contracts/publishing";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import {
  resolveYouTubePostSettings,
  youTubeSettingsProblem,
  youTubeThumbnailProblem,
} from "./youtube-post-settings";

export class YouTubePostSettingsError extends Error {}

export async function validateYouTubePost(input: {
  workspaceId: string;
  settings: SocialYouTubeSettings | null | undefined;
  thumbnailAssetId: string | null | undefined;
  text: string;
}) {
  const problem = youTubeSettingsProblem(input.settings, input.text);
  if (problem) throw new YouTubePostSettingsError(problem);
  const thumbnail = input.thumbnailAssetId
    ? (
        await findReadyMediaAssets({
          workspaceId: input.workspaceId,
          mediaAssetIds: [input.thumbnailAssetId],
        })
      )[0]
    : null;
  if (input.thumbnailAssetId) {
    const problem = youTubeThumbnailProblem(thumbnail);
    if (problem) throw new YouTubePostSettingsError(problem);
  }
  return {
    settings: resolveYouTubePostSettings(input.settings, input.text),
    thumbnail,
  };
}
