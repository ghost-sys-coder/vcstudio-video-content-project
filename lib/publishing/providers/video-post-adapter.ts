import "server-only";

import type { PublishVideoRequest } from "@/lib/publishing/video-publish-provider";
import {
  PublishProviderError,
  type PublishFailure,
} from "@/lib/publishing/video-publish-provider";
import type { PublishPostRequest } from "@/lib/publishing/social-post-provider";

/**
 * Turns a post request into the video-publication request the existing,
 * already-deployed video providers accept.
 *
 * Four of the five destinations reach video through code that is in production
 * today. Reusing it — rather than reimplementing chunked uploads, resumable
 * containers, and TikTok's consent handling a second time — is the whole reason
 * a post targeting a video platform is cheap to support.
 *
 * The mapping is deliberately explicit about what a post does not have: there is
 * no separate title or tag list, so the title is derived from the first line and
 * tags are empty. `visibility` is always `public`, because a post is something
 * someone chose to publish; the video pipeline's private/unlisted options belong
 * to render publishing, where a draft upload is a real workflow.
 */
export function toVideoPublishRequest(
  request: PublishPostRequest,
): PublishVideoRequest {
  const video = request.media[0];
  if (!video || video.kind !== "video")
    throwFailure({
      category: "invalid_metadata",
      safeMessage: "This platform needs exactly one video attached.",
      retriable: false,
      mayHavePublished: false,
    });

  const firstLine = request.text.split(/\r?\n/, 1)[0]?.trim() ?? "";

  return {
    tokens: request.tokens,
    account: request.account,
    sourceUrl: video.sourceUrl,
    sizeBytes: video.sizeBytes,
    contentType: video.contentType,
    title: firstLine.slice(0, 100) || "Untitled post",
    description: request.text,
    tags: [],
    visibility: "public",
    caption: request.text,
    shareToFeed: true,
    providerOperationId: request.providerOperationId,
    providerOperationSecret: request.providerOperationSecret,
    onProviderOperationCreated: request.onProviderOperationCreated,
    waitForProcessing: request.waitForProcessing,
    onProgress: request.onProgress,
    onProcessingProgress: request.onProgress,
  };
}

function throwFailure(failure: PublishFailure): never {
  throw new PublishProviderError(failure);
}
