import "server-only";

import { z } from "zod";
import type { ContentPlatform } from "@/db/schema";
import type {
  PublishPostRequest,
  PublishPostResult,
  SocialPostProvider,
} from "@/lib/publishing/social-post-provider";
import { isNeverSentNetworkError } from "@/lib/publishing/network-failure";
import { toVideoPublishRequest } from "@/lib/publishing/providers/video-post-adapter";
import {
  PublishProviderError,
  type PublishFailure,
  type VideoPublishProvider,
} from "@/lib/publishing/video-publish-provider";

const idSchema = z.object({ id: z.string().min(1) });
const postIdSchema = z.object({
  id: z.string().min(1),
  post_id: z.string().min(1).optional(),
});

function fail(failure: PublishFailure): never {
  throw new PublishProviderError(failure);
}

function failureForResponse(
  response: Response,
  mayHavePublished = false,
): PublishFailure {
  if (response.status === 401)
    return {
      category: "authorization_expired",
      safeMessage:
        "The Facebook Page authorization expired. Reconnect the Page and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 403)
    return {
      category: "insufficient_permissions",
      safeMessage:
        "The connected Facebook account can no longer publish to this Page.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 429)
    return {
      category: "rate_limited",
      safeMessage: "Facebook is rate limiting posts. Try again shortly.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  if (response.status >= 500)
    return {
      category: mayHavePublished
        ? "transport_ambiguous"
        : "provider_server_error",
      safeMessage: mayHavePublished
        ? "Facebook may have created the post but did not confirm it. Check the Page before retrying."
        : "Facebook had a server error. Try again shortly.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  return {
    category: mayHavePublished ? "transport_ambiguous" : "provider_error",
    safeMessage: mayHavePublished
      ? "Facebook did not confirm the post. Check the Page before retrying."
      : "Facebook rejected the post.",
    retriable: false,
    mayHavePublished,
  };
}

/**
 * Posts to a connected Facebook Page.
 *
 * Three shapes, because Facebook exposes three endpoints: a text post to
 * `/feed`, a photo post (multiple images are uploaded **unpublished** first,
 * then referenced from one feed post so they appear as a single album rather
 * than several separate posts), and a video, which delegates to the existing
 * chunked-upload video provider.
 *
 * Images are handed to Facebook as signed R2 URLs rather than uploaded bytes:
 * Graph fetches the URL itself, which is why the signed URL TTL must outlive the
 * publish job.
 */
export class FacebookSocialPostProvider implements SocialPostProvider {
  readonly platform: ContentPlatform = "facebook";

  constructor(
    private readonly input: {
      apiVersion: string;
      videoProvider: VideoPublishProvider;
    },
  ) {}

  private graphUrl(path: string): URL {
    return new URL(
      `https://graph.facebook.com/${this.input.apiVersion}/${path}`,
    );
  }

  async publishPost(request: PublishPostRequest): Promise<PublishPostResult> {
    const pageId = request.account.externalAccountId;
    const videos = request.media.filter((item) => item.kind === "video");
    const images = request.media.filter((item) => item.kind === "image");

    if (videos.length > 0) {
      const result = await this.input.videoProvider.publishVideo(
        toVideoPublishRequest(request),
      );
      return {
        externalPostId: result.externalVideoId,
        externalPostUrl: result.externalVideoUrl,
        completionStage: result.completionStage,
      };
    }

    const attachedMedia: string[] = [];
    for (const [index, image] of images.entries()) {
      const url = this.graphUrl(`${encodeURIComponent(pageId)}/photos`);
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${request.tokens.accessToken}` },
        body: new URLSearchParams({
          url: image.sourceUrl,
          // Unpublished, so the album post below is the only thing that appears.
          published: "false",
          ...(image.altText ? { alt_text_custom: image.altText } : {}),
        }),
      });
      const parsed = idSchema.safeParse(
        await response.json().catch(() => ({})),
      );
      if (!response.ok || !parsed.success) fail(failureForResponse(response));
      attachedMedia.push(parsed.data.id);
      await request.onProgress?.(
        Math.floor(((index + 1) / images.length) * 80),
      );
    }

    const body = new URLSearchParams({ message: request.text });
    attachedMedia.forEach((mediaId, index) => {
      body.set(
        `attached_media[${index}]`,
        JSON.stringify({ media_fbid: mediaId }),
      );
    });

    let response: Response;
    try {
      response = await fetch(
        this.graphUrl(`${encodeURIComponent(pageId)}/feed`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${request.tokens.accessToken}` },
          body,
        },
      );
    } catch (error) {
      // A connection that was never established cannot have posted anything, so
      // it is safe to retry and wrong to report as ambiguous. Anything else that
      // throws here may have gone out already.
      if (isNeverSentNetworkError(error))
        fail({
          category: "network_unreachable",
          safeMessage:
            "Could not reach Facebook. The post was not sent; it will be retried.",
          retriable: true,
          mayHavePublished: false,
        });
      fail({
        category: "transport_ambiguous",
        safeMessage:
          "Facebook may have created the post but did not confirm it. Check the Page before retrying.",
        retriable: false,
        mayHavePublished: true,
      });
    }
    const parsed = postIdSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, attachedMedia.length > 0));

    const postId = parsed.data.post_id ?? parsed.data.id;
    await request.onProgress?.(100);
    return {
      externalPostId: postId,
      externalPostUrl: `https://www.facebook.com/${encodeURIComponent(postId)}`,
      completionStage: "published",
    };
  }
}
