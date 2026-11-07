import "server-only";

import type { ContentPlatform } from "@/db/schema";
import type {
  PublishPostRequest,
  PublishPostResult,
  SocialPostProvider,
} from "@/lib/publishing/social-post-provider";
import { toVideoPublishRequest } from "@/lib/publishing/providers/video-post-adapter";
import type { VideoPublishProvider } from "@/lib/publishing/video-publish-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";
import {
  resolveYouTubePostSettings,
  youTubeSettingsProblem,
} from "@/lib/social/youtube-post-settings";

/**
 * A YouTube "post" is a video upload.
 *
 * YouTube has **no public API for Community Posts** — there is no supported way
 * to publish text or an image to a channel. So the only honest thing a YouTube
 * destination can be is an upload of the post's attached video, with the body as
 * the description. The composer enforces this up front by refusing to offer
 * YouTube unless a video is attached, so this adapter is never reached with
 * anything else.
 */
export class YouTubeSocialPostProvider implements SocialPostProvider {
  readonly platform: ContentPlatform = "youtube";

  constructor(private readonly videoProvider: VideoPublishProvider) {}

  async publishPost(request: PublishPostRequest): Promise<PublishPostResult> {
    const problem = youTubeSettingsProblem(
      request.youtubeSettings,
      request.text,
    );
    if (problem)
      throw new PublishProviderError({
        category: "invalid_metadata",
        safeMessage: problem,
        retriable: false,
        mayHavePublished: false,
      });
    const youtube = resolveYouTubePostSettings(
      request.youtubeSettings,
      request.text,
    );
    const result = await this.videoProvider.publishVideo({
      ...toVideoPublishRequest(request),
      title: youtube.title,
      description: youtube.description ?? request.text,
      tags: youtube.tags,
      visibility: youtube.visibility,
      disclosures: {
        madeForKids: youtube.madeForKids,
        containsSyntheticMedia: youtube.containsSyntheticMedia,
      },
    });
    return {
      externalPostId: result.externalVideoId,
      externalPostUrl: result.externalVideoUrl,
      completionStage: result.completionStage,
    };
  }
}
