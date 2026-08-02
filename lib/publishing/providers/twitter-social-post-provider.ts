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
 * X describes a rejection in `title`/`detail`. Only those two are surfaced, and
 * truncated — echoing a whole provider body to a user risks leaking request data
 * back out, but without X's own sentence a 4xx is undiagnosable from the outside.
 */
const problemSchema = z.object({
  title: z.string().min(1).optional(),
  detail: z.string().min(1).optional(),
});

function describeProblem(body: string): string {
  const parsed = problemSchema.safeParse(safeJson(body));
  if (!parsed.success) return "";
  const stated = parsed.data.detail ?? parsed.data.title;
  return stated ? ` X said: ${stated.slice(0, 200)}` : "";
}

/**
 * A 2xx whose body does not match the documented shape is **not** a rejection —
 * the call was accepted and X may well have acted on it. Reporting that as a
 * plain failure is how a post that is live on the account gets recorded as
 * failed, so the caller states whether this stage could have published.
 */
function failureForUnreadableBody(input: {
  stage: string;
  status: number;
  mayHavePublished: boolean;
}): PublishFailure {
  return {
    category: input.mayHavePublished ? "transport_ambiguous" : "provider_error",
    safeMessage: input.mayHavePublished
      ? `X accepted ${input.stage} (HTTP ${input.status}) but returned an unrecognised response, so the post may already be live. Check the account before trying again.`
      : `X returned an unrecognised response to ${input.stage} (HTTP ${input.status}).`,
    retriable: false,
    mayHavePublished: input.mayHavePublished,
  };
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
  options: { stage: string; mayHavePublished?: boolean },
): PublishFailure {
  const { stage } = options;
  const mayHavePublished = options.mayHavePublished ?? false;
  const stated = describeProblem(body);

  if (response.status === 401)
    return {
      category: "authorization_expired",
      safeMessage: `The X authorization expired. Reconnect X and try again.${stated}`,
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
      safeMessage: `The connected X account is not permitted to perform ${stage}. Check the app's access level and the granted scopes.${stated}`,
      retriable: false,
      mayHavePublished,
    };
  // A 404 is ours, not the account's: it means the integration called an
  // endpoint X does not serve, which no amount of reconnecting will fix.
  if (response.status === 404)
    return {
      category: "provider_endpoint_missing",
      safeMessage: `X does not recognise the endpoint used for ${stage} (HTTP 404). This is a fault in the integration rather than the connected account.${stated}`,
      retriable: false,
      mayHavePublished,
    };
  // X meters its API in credits, and answers an exhausted balance with 402
  // rather than 429. The distinction is the whole point: 429 is a rolling
  // window that clears on its own, while a depleted balance clears only when
  // the billing period resets or the plan is topped up. Retrying is futile in
  // exactly the way a retired API version is — same reasoning as LinkedIn's 426.
  if (response.status === 402)
    return {
      category: "quota_exceeded",
      safeMessage: `X rejected ${stage} because the app's API credits are exhausted. Top up or upgrade the X API plan in the developer portal — retrying will not help until the balance resets.${stated}`,
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 429)
    return {
      category: "rate_limited",
      // X's free and basic tiers cap posts per app and per user over rolling
      // windows, so this is a routine outcome rather than an anomaly.
      safeMessage: `X is rate limiting posts. The account or app has hit its posting cap; try again later.${stated}`,
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  if (response.status === 400 || response.status === 422)
    return {
      category: "invalid_metadata",
      safeMessage: `X rejected the content sent for ${stage}.${stated}`,
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
        : `X had a server error during ${stage} (HTTP ${response.status}). Try again shortly.`,
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  // Anything left is a status this integration has never seen. Naming the stage
  // and the status is the whole diagnostic — without them this branch reports
  // every unanticipated fault with one indistinguishable sentence.
  return {
    category: mayHavePublished ? "transport_ambiguous" : "provider_error",
    safeMessage: mayHavePublished
      ? `X did not confirm ${stage} (HTTP ${response.status}). Check the account before retrying.${stated}`
      : `The X post could not be created: ${stage} returned HTTP ${response.status}.${stated}`,
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
    if (!response.ok)
      fail(failureForResponse(response, raw, { stage: "the image upload" }));
    const parsed = mediaIdSchema.safeParse(safeJson(raw));
    if (!parsed.success)
      fail(
        failureForUnreadableBody({
          stage: "the image upload",
          status: response.status,
          // Uploading media publishes nothing on its own.
          mayHavePublished: false,
        }),
      );
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
    if (!initialize.ok)
      fail(
        failureForResponse(initialize, initializeRaw, {
          stage: "starting the video upload",
        }),
      );
    const initialized = mediaIdSchema.safeParse(safeJson(initializeRaw));
    if (!initialized.success)
      fail(
        failureForUnreadableBody({
          stage: "starting the video upload",
          status: initialize.status,
          mayHavePublished: false,
        }),
      );
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
      if (!append.ok)
        fail(
          failureForResponse(append, await append.text(), {
            stage: `sending video chunk ${segment + 1}`,
          }),
        );
    }

    const finalize = await fetch(
      `${API_BASE}/media/upload/${encodeURIComponent(mediaId)}/finalize`,
      { method: "POST", headers: authorization },
    );
    const finalizeRaw = await finalize.text();
    if (!finalize.ok)
      fail(
        failureForResponse(finalize, finalizeRaw, {
          stage: "completing the video upload",
        }),
      );
    const finalized = mediaIdSchema.safeParse(safeJson(finalizeRaw));
    if (!finalized.success)
      fail(
        failureForUnreadableBody({
          stage: "completing the video upload",
          status: finalize.status,
          mayHavePublished: false,
        }),
      );

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
      if (!status.ok)
        fail(
          failureForResponse(status, raw, {
            stage: "checking video processing",
          }),
        );
      const parsed = mediaIdSchema.safeParse(safeJson(raw));
      if (!parsed.success)
        fail(
          failureForUnreadableBody({
            stage: "checking video processing",
            status: status.status,
            mayHavePublished: false,
          }),
        );
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
    if (!response.ok)
      fail(failureForResponse(response, raw, { stage: "post creation" }));
    const parsed = tweetSchema.safeParse(safeJson(raw));
    if (!parsed.success)
      fail(
        failureForUnreadableBody({
          stage: "post creation",
          status: response.status,
          // X accepted the request. Treating this as a clean failure is how a
          // live post gets recorded as failed and then posted a second time.
          mayHavePublished: true,
        }),
      );

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
