import "server-only";

import { z } from "zod";
import type { ContentPlatform } from "@/db/schema";
import { isNeverSentNetworkError } from "@/lib/publishing/network-failure";
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

const API_BASE = "https://api.x.com/2";

/** X's documented chunk ceiling for `append` is 5 MB; stay under it. */
const UPLOAD_CHUNK_BYTES = 4 * 1024 * 1024;
/** Video transcoding is asynchronous; give it a bounded number of polls. */
const MAX_PROCESSING_POLLS = 20;
const DEFAULT_POLL_SECONDS = 5;

const mediaIdSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    processing_info: z
      .object({
        state: z.enum(["pending", "in_progress", "failed", "succeeded"]),
        check_after_secs: z.number().int().nonnegative().optional(),
      })
      .optional(),
  }),
});

const tweetSchema = z.object({
  data: z.object({ id: z.string().min(1) }),
});

function fail(failure: PublishFailure): never {
  throw new PublishProviderError(failure);
}

/**
 * X answers a repeated post with 403 and a `duplicate` detail rather than a
 * distinct status. Worth separating: a scheduled post that fires twice, or a
 * retry after an ambiguous transport failure, hits this — and "you already
 * posted this" is a completely different instruction to the user than "your
 * account cannot post".
 */
function isDuplicateRejection(body: string): boolean {
  return /duplicate/i.test(body);
}

function failureForResponse(
  response: Response,
  body: string,
  mayHavePublished = false,
): PublishFailure {
  if (response.status === 401)
    return {
      category: "authorization_expired",
      safeMessage: "The X authorization expired. Reconnect X and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 403 && isDuplicateRejection(body))
    return {
      category: "invalid_metadata",
      safeMessage:
        "X rejected this as a duplicate — the same text was posted recently. Change the wording and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 403)
    return {
      category: "insufficient_permissions",
      safeMessage:
        "The connected X account is not permitted to post. Check the app's access level and the granted scopes.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 429)
    return {
      category: "rate_limited",
      // X's free and basic tiers cap posts per app and per user over rolling
      // windows, so this is a routine outcome rather than an anomaly.
      safeMessage:
        "X is rate limiting posts. The account or app has hit its posting cap; try again later.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  if (response.status === 400 || response.status === 422)
    return {
      category: "invalid_metadata",
      safeMessage: "X rejected the post content.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status >= 500)
    return {
      category: mayHavePublished
        ? "transport_ambiguous"
        : "provider_server_error",
      safeMessage: mayHavePublished
        ? "X may have created the post but did not confirm it. Check the account before retrying."
        : "X had a server error. Try again shortly.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  return {
    category: mayHavePublished ? "transport_ambiguous" : "provider_error",
    safeMessage: mayHavePublished
      ? "X did not confirm the post. Check the account before retrying."
      : "The X post could not be created.",
    retriable: false,
    mayHavePublished,
  };
}

/**
 * X's media category, which decides how the platform transcodes and validates an
 * upload. Sending the wrong one is accepted at upload and then fails at post
 * time, so it is derived from the asset kind rather than defaulted.
 */
function mediaCategory(item: SocialPostMediaItem): string {
  if (item.kind === "video") return "tweet_video";
  return item.contentType === "image/gif" ? "tweet_gif" : "tweet_image";
}

/**
 * Posts to a connected X account via the v2 API.
 *
 * Media is uploaded first and referenced by id, so this is a two-phase flow:
 * images go up in a single multipart request, video goes through the chunked
 * initialize/append/finalize sequence and then has to be **waited on** — X
 * transcodes asynchronously and rejects a post that references media still in
 * `in_progress`.
 *
 * The text ceiling is enforced upstream by the capability matrix rather than
 * here, because it depends on the account's tier and the composer needs to show
 * it while writing rather than at publish time.
 */
export class TwitterSocialPostProvider implements SocialPostProvider {
  readonly platform: ContentPlatform = "twitter";

  private async fetchBytes(item: SocialPostMediaItem): Promise<ArrayBuffer> {
    const source = await fetch(item.sourceUrl);
    if (!source.ok)
      fail({
        category: "asset_unavailable",
        safeMessage:
          "An attached file could not be read from storage. Re-upload it and try again.",
        retriable: false,
        mayHavePublished: false,
      });
    return source.arrayBuffer();
  }

  private async uploadImage(input: {
    accessToken: string;
    item: SocialPostMediaItem;
  }): Promise<string> {
    const bytes = await this.fetchBytes(input.item);
    const form = new FormData();
    form.set(
      "media",
      new Blob([bytes], { type: input.item.contentType }),
      input.item.fileName,
    );
    form.set("media_category", mediaCategory(input.item));

    const response = await fetch(`${API_BASE}/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.accessToken}` },
      body: form,
    });
    const raw = await response.text();
    const parsed = mediaIdSchema.safeParse(safeJson(raw));
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, raw));
    return parsed.data.data.id;
  }

  private async uploadVideo(input: {
    accessToken: string;
    item: SocialPostMediaItem;
    waitForProcessing?: (milliseconds: number) => Promise<void>;
  }): Promise<string> {
    const authorization = { Authorization: `Bearer ${input.accessToken}` };

    const initialize = await fetch(`${API_BASE}/media/upload/initialize`, {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: JSON.stringify({
        media_type: input.item.contentType,
        total_bytes: input.item.sizeBytes,
        media_category: mediaCategory(input.item),
      }),
    });
    const initializeRaw = await initialize.text();
    const initialized = mediaIdSchema.safeParse(safeJson(initializeRaw));
    if (!initialize.ok || !initialized.success)
      fail(failureForResponse(initialize, initializeRaw));
    const mediaId = initialized.data.data.id;

    const bytes = new Uint8Array(await this.fetchBytes(input.item));
    for (
      let offset = 0, segment = 0;
      offset < bytes.byteLength;
      offset += UPLOAD_CHUNK_BYTES, segment += 1
    ) {
      const chunk = bytes.subarray(offset, offset + UPLOAD_CHUNK_BYTES);
      const form = new FormData();
      form.set("segment_index", String(segment));
      form.set(
        "media",
        new Blob([chunk], { type: "application/octet-stream" }),
        input.item.fileName,
      );
      const append = await fetch(
        `${API_BASE}/media/upload/${encodeURIComponent(mediaId)}/append`,
        { method: "POST", headers: authorization, body: form },
      );
      if (!append.ok) fail(failureForResponse(append, await append.text()));
    }

    const finalize = await fetch(
      `${API_BASE}/media/upload/${encodeURIComponent(mediaId)}/finalize`,
      { method: "POST", headers: authorization },
    );
    const finalizeRaw = await finalize.text();
    const finalized = mediaIdSchema.safeParse(safeJson(finalizeRaw));
    if (!finalize.ok || !finalized.success)
      fail(failureForResponse(finalize, finalizeRaw));

    await this.waitForTranscode({
      accessToken: input.accessToken,
      mediaId,
      processingInfo: finalized.data.data.processing_info,
      waitForProcessing: input.waitForProcessing,
    });
    return mediaId;
  }

  /**
   * Blocks until X finishes transcoding. Referencing a still-processing media id
   * in a post is rejected, so this is not an optimisation — skipping it makes
   * every video post fail.
   */
  private async waitForTranscode(input: {
    accessToken: string;
    mediaId: string;
    processingInfo:
      { state: string; check_after_secs?: number | undefined } | undefined;
    waitForProcessing?: (milliseconds: number) => Promise<void>;
  }): Promise<void> {
    let info = input.processingInfo;
    for (let attempt = 0; attempt < MAX_PROCESSING_POLLS; attempt += 1) {
      if (!info || info.state === "succeeded") return;
      if (info.state === "failed")
        fail({
          category: "video_rejected",
          safeMessage:
            "X could not process the attached video. Check its format, length, and dimensions.",
          retriable: false,
          mayHavePublished: false,
        });

      const seconds = info.check_after_secs ?? DEFAULT_POLL_SECONDS;
      // Injected by the durable worker so a long transcode does not burn
      // wall-clock inside the task; tests pass nothing and tick immediately.
      await input.waitForProcessing?.(seconds * 1000);

      const status = await fetch(
        `${API_BASE}/media/upload?media_id=${encodeURIComponent(input.mediaId)}&command=STATUS`,
        { headers: { Authorization: `Bearer ${input.accessToken}` } },
      );
      const raw = await status.text();
      const parsed = mediaIdSchema.safeParse(safeJson(raw));
      if (!status.ok || !parsed.success) fail(failureForResponse(status, raw));
      info = parsed.data.data.processing_info;
      if (!info) return;
    }
    fail({
      category: "provider_server_error",
      safeMessage:
        "X is still processing the attached video. Try posting again in a few minutes.",
      retriable: true,
      mayHavePublished: false,
    });
  }

  async publishPost(request: PublishPostRequest): Promise<PublishPostResult> {
    const mediaIds: string[] = [];
    for (const [index, item] of request.media.entries()) {
      mediaIds.push(
        item.kind === "video"
          ? await this.uploadVideo({
              accessToken: request.tokens.accessToken,
              item,
              waitForProcessing: request.waitForProcessing,
            })
          : await this.uploadImage({
              accessToken: request.tokens.accessToken,
              item,
            }),
      );
      // Transfer dominates the runtime; keep the last 10% for post creation.
      await request.onProgress?.(
        Math.floor(((index + 1) / request.media.length) * 90),
      );
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE}/tweets`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${request.tokens.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: request.text,
          ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}),
        }),
      });
    } catch (error) {
      // A connection that was never established cannot have posted, so retrying
      // is safe and reporting it as ambiguous would be wrong.
      if (isNeverSentNetworkError(error))
        fail({
          category: "network_unreachable",
          safeMessage:
            "Could not reach X. The post was not sent; it will be retried.",
          retriable: true,
          mayHavePublished: false,
        });
      fail({
        category: "transport_ambiguous",
        safeMessage:
          "X may have created the post but did not confirm it. Check the account before retrying.",
        retriable: false,
        mayHavePublished: true,
      });
    }

    const raw = await response.text();
    const parsed = tweetSchema.safeParse(safeJson(raw));
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, raw));

    await request.onProgress?.(100);
    const postId = parsed.data.data.id;
    return {
      externalPostId: postId,
      // The `/i/web/status/` form resolves without knowing the handle, which
      // matters because a handle can change after the post is stored.
      externalPostUrl: `https://x.com/i/web/status/${postId}`,
      completionStage: "published",
    };
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}
