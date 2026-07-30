import "server-only";

import type { ContentPlatform } from "@/db/schema";
import type {
  PublishPostRequest,
  PublishPostResult,
  SocialPostProvider,
} from "@/lib/publishing/social-post-provider";
import { toVideoPublishRequest } from "@/lib/publishing/providers/video-post-adapter";
import type { VideoPublishProvider } from "@/lib/publishing/video-publish-provider";

/**
 * A TikTok "post" is an inbox video upload.
 *
 * This app uses the least-privilege `video.upload` scope and delivers to the
 * creator's TikTok inbox rather than Direct Post, so a human still finishes the
 * post inside TikTok. That is reported honestly as `inbox_delivered` rather than
 * as a published post — the same contract the render publish path already uses,
 * and the reason this adapter delegates to it instead of reimplementing the
 * upload.
 */
export class TikTokSocialPostProvider implements SocialPostProvider {
  readonly platform: ContentPlatform = "tiktok";

  constructor(private readonly videoProvider: VideoPublishProvider) {}

  async publishPost(request: PublishPostRequest): Promise<PublishPostResult> {
    const result = await this.videoProvider.publishVideo(
      toVideoPublishRequest(request),
    );
    return {
      externalPostId: result.externalVideoId,
      externalPostUrl: result.externalVideoUrl,
      completionStage: result.completionStage,
    };
  }
}
