import "server-only";

import { z } from "zod";
import type { ContentPlatform } from "@/db/schema";
import type {
  PublishPostRequest,
  PublishPostResult,
  SocialPostProvider,
} from "@/lib/publishing/social-post-provider";
import { toVideoPublishRequest } from "@/lib/publishing/providers/video-post-adapter";
import {
  PublishProviderError,
  type PublishFailure,
  type VideoPublishProvider,
} from "@/lib/publishing/video-publish-provider";

const idSchema = z.object({ id: z.string().min(1) });
const permalinkSchema = z.object({ permalink: z.string().min(1).optional() });

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
        "The Instagram authorization expired. Reconnect the account and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 403)
    return {
      category: "insufficient_permissions",
      safeMessage:
        "The connected Instagram account is not permitted to publish. It must be a professional account linked to a Facebook Page.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 429)
    return {
      category: "rate_limited",
      safeMessage:
        "Instagram is rate limiting posts — it allows a limited number per day. Try again later.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  if (response.status >= 500)
    return {
      category: mayHavePublished
        ? "transport_ambiguous"
        : "provider_server_error",
      safeMessage: mayHavePublished
        ? "Instagram may have created the post but did not confirm it. Check the account before retrying."
        : "Instagram had a server error. Try again shortly.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  return {
    category: mayHavePublished ? "transport_ambiguous" : "provider_error",
    safeMessage: mayHavePublished
      ? "Instagram did not confirm the post. Check the account before retrying."
      : "Instagram rejected the post. Check that the images meet its aspect-ratio rules.",
    retriable: false,
    mayHavePublished,
  };
}

/**
 * Posts to a connected Instagram professional account.
 *
 * Instagram is always a two-step publish: build a media *container*, then
 * publish it. A carousel is three steps, because each child needs its own
 * container first. Video (a Reel) delegates to the existing video provider,
 * which already handles container polling and resumption.
 *
 * Instagram never accepts a text-only post, which the composer's capability
 * matrix enforces before anything reaches here.
 */
export class InstagramSocialPostProvider implements SocialPostProvider {
  readonly platform: ContentPlatform = "instagram";

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

  private async post(
    url: URL,
    accessToken: string,
    body: URLSearchParams,
  ): Promise<string> {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body,
    });
    const parsed = idSchema.safeParse(await response.json().catch(() => ({})));
    if (!response.ok || !parsed.success) fail(failureForResponse(response));
    return parsed.data.id;
  }

  async publishPost(request: PublishPostRequest): Promise<PublishPostResult> {
    const accountId = request.account.externalAccountId;
    const accessToken = request.tokens.accessToken;
    const images = request.media.filter((item) => item.kind === "image");

    if (request.media.some((item) => item.kind === "video")) {
      const result = await this.input.videoProvider.publishVideo(
        toVideoPublishRequest(request),
      );
      return {
        externalPostId: result.externalVideoId,
        externalPostUrl: result.externalVideoUrl,
        completionStage: result.completionStage,
      };
    }

    if (images.length === 0)
      fail({
        category: "invalid_metadata",
        safeMessage: "Instagram needs at least one image or a video.",
        retriable: false,
        mayHavePublished: false,
      });

    let containerId: string;
    if (images.length === 1) {
      containerId = await this.post(
        this.graphUrl(`${encodeURIComponent(accountId)}/media`),
        accessToken,
        new URLSearchParams({
          image_url: images[0].sourceUrl,
          caption: request.text,
          ...(images[0].altText ? { alt_text: images[0].altText } : {}),
        }),
      );
    } else {
      const children: string[] = [];
      for (const [index, image] of images.entries()) {
        children.push(
          await this.post(
            this.graphUrl(`${encodeURIComponent(accountId)}/media`),
            accessToken,
            new URLSearchParams({
              image_url: image.sourceUrl,
              is_carousel_item: "true",
              ...(image.altText ? { alt_text: image.altText } : {}),
            }),
          ),
        );
        await request.onProgress?.(
          Math.floor(((index + 1) / images.length) * 70),
        );
      }
      containerId = await this.post(
        this.graphUrl(`${encodeURIComponent(accountId)}/media`),
        accessToken,
        new URLSearchParams({
          media_type: "CAROUSEL",
          children: children.join(","),
          caption: request.text,
        }),
      );
    }

    // Recorded before publishing so a retry can resume from the container
    // instead of building a second one and posting twice.
    await request.onProviderOperationCreated?.(containerId);
    await request.onProgress?.(85);

    let publishResponse: Response;
    try {
      publishResponse = await fetch(
        this.graphUrl(`${encodeURIComponent(accountId)}/media_publish`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: new URLSearchParams({ creation_id: containerId }),
        },
      );
    } catch {
      fail({
        category: "transport_ambiguous",
        safeMessage:
          "Instagram may have created the post but did not confirm it. Check the account before retrying.",
        retriable: false,
        mayHavePublished: true,
      });
    }
    const published = idSchema.safeParse(
      await publishResponse.json().catch(() => ({})),
    );
    if (!publishResponse.ok || !published.success)
      fail(failureForResponse(publishResponse, true));

    const permalinkUrl = this.graphUrl(encodeURIComponent(published.data.id));
    permalinkUrl.searchParams.set("fields", "permalink");
    const permalinkResponse = await fetch(permalinkUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const permalink = permalinkSchema.safeParse(
      await permalinkResponse.json().catch(() => ({})),
    );

    await request.onProgress?.(100);
    return {
      externalPostId: published.data.id,
      // The post exists either way; a missing permalink is a read failure, not a
      // publish failure, so it must not fail the publication.
      externalPostUrl:
        permalink.data?.permalink ??
        `https://www.instagram.com/p/${encodeURIComponent(published.data.id)}/`,
      completionStage: "published",
    };
  }
}
