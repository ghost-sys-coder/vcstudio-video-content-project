import "server-only";

import { z } from "zod";
import type { ContentPlatform } from "@/db/schema";
import type {
  PublishPostRequest,
  PublishPostResult,
  SocialPostMediaItem,
  SocialPostProvider,
} from "@/lib/publishing/social-post-provider";
import {
  PublishProviderError,
  type PublishFailure,
} from "@/lib/publishing/video-publish-provider";

const REST_BASE = "https://api.linkedin.com/rest";

const initializeUploadSchema = z.object({
  value: z.object({
    uploadUrl: z.string().min(1),
    image: z.string().min(1).optional(),
    video: z.string().min(1).optional(),
  }),
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
        "The LinkedIn authorization expired. Reconnect LinkedIn and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 403)
    return {
      category: "insufficient_permissions",
      safeMessage:
        "The connected LinkedIn account is not permitted to post. Check the app's approved products.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 429)
    return {
      category: "rate_limited",
      safeMessage: "LinkedIn is rate limiting posts. Try again shortly.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  if (response.status === 400 || response.status === 422)
    return {
      category: "invalid_metadata",
      safeMessage: "LinkedIn rejected the post content.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status >= 500)
    return {
      category: mayHavePublished
        ? "transport_ambiguous"
        : "provider_server_error",
      safeMessage: mayHavePublished
        ? "LinkedIn may have created the post but did not confirm it. Check the profile before retrying."
        : "LinkedIn had a server error. Try again shortly.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  return {
    category: mayHavePublished ? "transport_ambiguous" : "provider_error",
    safeMessage: mayHavePublished
      ? "LinkedIn did not confirm the post. Check the profile before retrying."
      : "The LinkedIn post could not be created.",
    retriable: false,
    mayHavePublished,
  };
}

/**
 * Posts to a connected LinkedIn member profile via the versioned `/rest/posts`
 * API.
 *
 * Media is uploaded first and referenced by URN, which is why this is a
 * three-step flow rather than one request: initialize an upload, `PUT` the bytes
 * straight from the signed R2 URL, then create the post referencing the returned
 * URN. Alt text is carried through — LinkedIn is one of the platforms that
 * accepts it, and it is the only accessibility control available once a post is
 * live.
 */
export class LinkedInSocialPostProvider implements SocialPostProvider {
  readonly platform: ContentPlatform = "linkedin";

  constructor(private readonly input: { apiVersion: string }) {}

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": this.input.apiVersion,
      "X-Restli-Protocol-Version": "2.0.0",
    };
  }

  private async uploadOne(input: {
    accessToken: string;
    owner: string;
    item: SocialPostMediaItem;
  }): Promise<string> {
    const isVideo = input.item.kind === "video";
    const endpoint = `${REST_BASE}/${isVideo ? "videos" : "images"}?action=initializeUpload`;
    const body = isVideo
      ? {
          initializeUploadRequest: {
            owner: input.owner,
            fileSizeBytes: input.item.sizeBytes,
            uploadCaptions: false,
            uploadThumbnail: false,
          },
        }
      : { initializeUploadRequest: { owner: input.owner } };

    const initialize = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...this.headers(input.accessToken),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const parsed = initializeUploadSchema.safeParse(
      await initialize.json().catch(() => ({})),
    );
    if (!initialize.ok || !parsed.success) fail(failureForResponse(initialize));

    const urn = isVideo ? parsed.data.value.video : parsed.data.value.image;
    if (!urn)
      fail({
        category: "provider_error",
        safeMessage: "LinkedIn did not return an upload target.",
        retriable: false,
        mayHavePublished: false,
      });

    const source = await fetch(input.item.sourceUrl);
    if (!source.ok)
      fail({
        category: "asset_unavailable",
        safeMessage:
          "An attached file could not be read from storage. Re-upload it and try again.",
        retriable: false,
        mayHavePublished: false,
      });

    const upload = await fetch(parsed.data.value.uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "content-type": input.item.contentType,
      },
      body: await source.arrayBuffer(),
    });
    if (!upload.ok) fail(failureForResponse(upload));
    return urn;
  }

  async publishPost(request: PublishPostRequest): Promise<PublishPostResult> {
    const owner = `urn:li:person:${request.account.externalAccountId}`;

    const uploaded: { urn: string; item: SocialPostMediaItem }[] = [];
    for (const [index, item] of request.media.entries()) {
      uploaded.push({
        urn: await this.uploadOne({
          accessToken: request.tokens.accessToken,
          owner,
          item,
        }),
        item,
      });
      // Media transfer is the slow part; reserve the last 10% for post creation.
      await request.onProgress?.(
        Math.floor(((index + 1) / request.media.length) * 90),
      );
    }

    const content =
      uploaded.length === 0
        ? undefined
        : uploaded.length === 1
          ? {
              media: {
                id: uploaded[0].urn,
                altText: uploaded[0].item.altText || undefined,
              },
            }
          : {
              multiImage: {
                images: uploaded.map((entry) => ({
                  id: entry.urn,
                  altText: entry.item.altText || undefined,
                })),
              },
            };

    let response: Response;
    try {
      response = await fetch(`${REST_BASE}/posts`, {
        method: "POST",
        headers: {
          ...this.headers(request.tokens.accessToken),
          "content-type": "application/json",
        },
        body: JSON.stringify({
          author: owner,
          commentary: request.text,
          visibility: "PUBLIC",
          distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
          ...(content ? { content } : {}),
        }),
      });
    } catch {
      // The request left; whether LinkedIn acted on it is unknown. Marked
      // ambiguous so the task refuses to retry and double-post.
      fail({
        category: "transport_ambiguous",
        safeMessage:
          "LinkedIn may have created the post but did not confirm it. Check the profile before retrying.",
        retriable: false,
        mayHavePublished: true,
      });
    }
    if (!response.ok) fail(failureForResponse(response));

    const postUrn =
      response.headers.get("x-restli-id") ??
      response.headers.get("x-linkedin-id");
    if (!postUrn)
      fail({
        category: "transport_ambiguous",
        safeMessage:
          "LinkedIn accepted the post but returned no identifier. Check the profile before retrying.",
        retriable: false,
        mayHavePublished: true,
      });

    await request.onProgress?.(100);
    return {
      externalPostId: postUrn,
      externalPostUrl: `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`,
      completionStage: "published",
    };
  }
}
