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
const permalinkSchema = z.object({ permalink: z.string().min(1).optional() });
const containerStatusSchema = z.object({
  status_code: z.enum([
    "EXPIRED",
    "ERROR",
    "FINISHED",
    "IN_PROGRESS",
    "PUBLISHED",
  ]),
});

/**
 * Image containers are processed asynchronously too, usually within seconds.
 * Publishing before `FINISHED` is rejected with "media not ready", so the
 * container is polled first, bounded at roughly two minutes.
 */
const CONTAINER_POLL_INTERVAL_MS = 3000;
const MAX_CONTAINER_POLLS = 40;
/** Graph API "media not ready for publishing" (code 9007, subcode 2207027). */
const MEDIA_NOT_READY_CODE = 9007;
const MEDIA_NOT_READY_SUBCODE = 2207027;
const graphErrorSchema = z.object({
  error: z
    .object({
      code: z.number().int().optional(),
      error_subcode: z.number().int().optional(),
      is_transient: z.boolean().optional(),
    })
    .optional(),
});

function fail(failure: PublishFailure): never {
  throw new PublishProviderError(failure);
}

function failureForResponse(
  response: Response,
  payload: unknown,
  mayHavePublished = false,
): PublishFailure {
  const parsed = graphErrorSchema.safeParse(payload);
  const error = parsed.success ? parsed.data.error : undefined;
  // A definite refusal: Instagram published nothing, and the same container
  // can be published once processing finishes.
  if (
    error?.code === MEDIA_NOT_READY_CODE ||
    error?.error_subcode === MEDIA_NOT_READY_SUBCODE
  )
    return {
      category: "provider_server_error",
      safeMessage:
        "Instagram was still processing the media. The post was not published; it will be retried.",
      retriable: true,
      mayHavePublished: false,
    };
  if (response.status === 401 || error?.code === 190)
    return {
      category: "authorization_expired",
      safeMessage:
        "The Instagram authorization expired. Reconnect the account and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 403 || error?.code === 10 || error?.code === 200)
    return {
      category: "insufficient_permissions",
      safeMessage:
        "The connected Instagram account is not permitted to publish. It must be a professional account linked to a Facebook Page.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 429 || [4, 17, 32, 613].includes(error?.code ?? -1))
    return {
      category: "rate_limited",
      safeMessage:
        "Instagram is rate limiting posts — it allows a limited number per day. Try again later.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  if (response.status >= 500 || error?.is_transient)
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
      `https://graph.instagram.com/${this.input.apiVersion}/${path}`,
    );
  }

  private async post(
    url: URL,
    accessToken: string,
    body: URLSearchParams,
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
      });
    } catch {
      // Creating a container cannot make content public. It is therefore safe
      // to retry even if Instagram received the request before the socket died.
      fail({
        category: "network_unreachable",
        safeMessage:
          "Could not reach Instagram. The post was not published; it will be retried.",
        retriable: true,
        mayHavePublished: false,
      });
    }
    const payload = await response.json().catch(() => ({}));
    const parsed = idSchema.safeParse(payload);
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, payload));
    return parsed.data.id;
  }

  /** Builds the single-image or carousel container that will be published. */
  private async createContainer(
    request: PublishPostRequest,
    images: PublishPostRequest["media"],
  ): Promise<string> {
    const mediaUrl = this.graphUrl(
      `${encodeURIComponent(request.account.externalAccountId)}/media`,
    );
    const accessToken = request.tokens.accessToken;
    if (images.length === 1)
      return this.post(
        mediaUrl,
        accessToken,
        new URLSearchParams({
          image_url: images[0].sourceUrl,
          caption: request.text,
          ...(images[0].altText ? { alt_text: images[0].altText } : {}),
        }),
      );

    const children: string[] = [];
    for (const [index, image] of images.entries()) {
      children.push(
        await this.post(
          mediaUrl,
          accessToken,
          new URLSearchParams({
            image_url: image.sourceUrl,
            is_carousel_item: "true",
            ...(image.altText ? { alt_text: image.altText } : {}),
          }),
        ),
      );
      await request.onProgress?.(
        Math.floor(((index + 1) / images.length) * 60),
      );
    }
    return this.post(
      mediaUrl,
      accessToken,
      new URLSearchParams({
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: request.text,
      }),
    );
  }

  private async readContainerStatus(
    containerId: string,
    accessToken: string,
  ): Promise<z.infer<typeof containerStatusSchema>["status_code"]> {
    const url = this.graphUrl(encodeURIComponent(containerId));
    url.searchParams.set("fields", "status_code");
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      // Nothing has been published yet; a status read is safe to repeat.
      fail({
        category: "network_unreachable",
        safeMessage:
          "Could not reach Instagram. The post was not published; it will be retried.",
        retriable: true,
        mayHavePublished: false,
      });
    }
    const payload = await response.json().catch(() => ({}));
    const status = containerStatusSchema.safeParse(payload);
    if (!response.ok || !status.success)
      fail(failureForResponse(response, payload));
    return status.data.status_code;
  }

  /**
   * Waits until Instagram has fetched and processed the container's images.
   * Publishing earlier is refused with "media not ready", which previously
   * surfaced as an unconfirmed post even though nothing had been published.
   */
  private async waitForContainer(
    request: PublishPostRequest,
    containerId: string,
  ): Promise<void> {
    for (let poll = 0; poll < MAX_CONTAINER_POLLS; poll += 1) {
      if (poll > 0)
        await request.waitForProcessing?.(CONTAINER_POLL_INTERVAL_MS);
      const status = await this.readContainerStatus(
        containerId,
        request.tokens.accessToken,
      );
      if (status === "FINISHED") return;
      if (status === "PUBLISHED")
        fail({
          category: "transport_ambiguous",
          safeMessage:
            "Instagram already published this post but its media id was not confirmed. Check the account before retrying.",
          retriable: false,
          mayHavePublished: true,
        });
      if (status === "ERROR" || status === "EXPIRED")
        fail({
          category: "provider_error",
          safeMessage:
            "Instagram could not process the images. Check that they are JPEGs within its aspect-ratio rules.",
          retriable: false,
          mayHavePublished: false,
        });
      await request.onProgress?.(
        Math.min(80, 60 + Math.floor((poll / MAX_CONTAINER_POLLS) * 20)),
      );
    }
    fail({
      category: "provider_server_error",
      safeMessage:
        "Instagram is still processing the images. The post was not published; it will be retried.",
      retriable: true,
      mayHavePublished: false,
    });
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

    // Resume a previous attempt's container rather than building a second one.
    // An expired container was never published, so it is safe to rebuild.
    const previous = request.providerOperationId;
    const reusable =
      previous !== null &&
      (await this.readContainerStatus(previous, accessToken)) !== "EXPIRED";
    const containerId = reusable
      ? previous
      : await this.createContainer(request, images);
    if (!reusable)
      // Recorded before publishing so a retry resumes from this container
      // instead of posting twice.
      await request.onProviderOperationCreated?.(containerId);

    await this.waitForContainer(request, containerId);
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
    } catch (error) {
      // A connection that was never established cannot have published the
      // container, so it is safe to retry and wrong to report as ambiguous.
      if (isNeverSentNetworkError(error))
        fail({
          category: "network_unreachable",
          safeMessage:
            "Could not reach Instagram. The post was not published; it will be retried.",
          retriable: true,
          mayHavePublished: false,
        });
      fail({
        category: "transport_ambiguous",
        safeMessage:
          "Instagram may have created the post but did not confirm it. Check the account before retrying.",
        retriable: false,
        mayHavePublished: true,
      });
    }
    const publishPayload = await publishResponse.json().catch(() => ({}));
    const published = idSchema.safeParse(publishPayload);
    if (!publishResponse.ok || !published.success)
      fail(failureForResponse(publishResponse, publishPayload, true));

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
