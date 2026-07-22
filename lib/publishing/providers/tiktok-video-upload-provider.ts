import "server-only";

import { z } from "zod";
import type { ContentPlatform } from "@/db/schema";
import {
  PublishProviderError,
  type AuthorizationRequest,
  type PlatformAccount,
  type PlatformTokens,
  type PublishFailure,
  type PublishVideoRequest,
  type PublishVideoResult,
  type VideoPublishProvider,
} from "@/lib/publishing/video-publish-provider";

const AUTHORIZATION_ENDPOINT = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";
const REVOKE_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/revoke/";
const USER_INFO_ENDPOINT = "https://open.tiktokapis.com/v2/user/info/";
const UPLOAD_INIT_ENDPOINT =
  "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const STATUS_ENDPOINT =
  "https://open.tiktokapis.com/v2/post/publish/status/fetch/";
const SCOPES = ["user.info.basic", "video.upload"] as const;
const MIN_CHUNK_BYTES = 5 * 1024 * 1024;
const MAX_CHUNK_BYTES = 64 * 1024 * 1024;
const STATUS_POLL_INTERVAL_MS = 5000;
const MAX_STATUS_POLLS = 120;

const tokenSchema = z.object({
  open_id: z.string().min(1),
  scope: z.string(),
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
  refresh_expires_in: z.number().int().positive(),
  token_type: z.string().min(1),
});
const userInfoSchema = z.object({
  data: z.object({
    user: z.object({
      open_id: z.string().min(1),
      display_name: z.string().min(1),
    }),
  }),
  error: z.object({ code: z.string() }),
});
const apiErrorSchema = z.object({
  error: z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
      log_id: z.string().optional(),
    })
    .optional(),
});
const initSchema = z.object({
  data: z.object({
    publish_id: z.string().min(1).max(64),
    upload_url: z.url(),
  }),
  error: z.object({ code: z.literal("ok") }),
});
const statusSchema = z.object({
  data: z.object({
    status: z.enum([
      "PROCESSING_UPLOAD",
      "PROCESSING_DOWNLOAD",
      "SEND_TO_USER_INBOX",
      "PUBLISH_COMPLETE",
      "FAILED",
    ]),
    fail_reason: z.string().optional(),
    publicaly_available_post_id: z
      .array(z.union([z.string(), z.number()]))
      .optional(),
    uploaded_bytes: z.number().int().nonnegative().optional(),
  }),
  error: z.object({ code: z.literal("ok") }),
});

type TikTokStatus = z.infer<typeof statusSchema>["data"];

function fail(failure: PublishFailure): never {
  throw new PublishProviderError(failure);
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function failureForResponse(
  response: Response,
  payload: unknown,
  mayHavePublished = false,
): PublishFailure {
  const parsed = apiErrorSchema.safeParse(payload);
  const code = parsed.success ? parsed.data.error?.code : undefined;
  if (response.status === 401 || code === "access_token_invalid")
    return {
      category: "authorization_expired",
      safeMessage: "The TikTok authorization expired. Reconnect the account.",
      retriable: false,
      mayHavePublished,
    };
  if (code === "scope_not_authorized")
    return {
      category: "insufficient_permissions",
      safeMessage: "TikTok did not grant permission to upload videos.",
      retriable: false,
      mayHavePublished,
    };
  if (
    response.status === 429 ||
    code === "rate_limit_exceeded" ||
    code?.startsWith("spam_risk_") ||
    code === "reached_active_user_cap"
  )
    return {
      category: "rate_limited",
      safeMessage: "TikTok's upload limit has been reached. Try again later.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status >= 500 || code === "internal_error")
    return {
      category: mayHavePublished
        ? "transport_ambiguous"
        : "provider_server_error",
      safeMessage: mayHavePublished
        ? "TikTok may have accepted the upload. Check the TikTok inbox before retrying."
        : "TikTok is temporarily unavailable. Try again later.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  return {
    category: "provider_error",
    safeMessage: "TikTok could not accept the video upload.",
    retriable: false,
    mayHavePublished,
  };
}

export type TikTokChunkPlan = {
  chunkSize: number;
  totalChunkCount: number;
};

export function createTikTokChunkPlan(videoSize: number): TikTokChunkPlan {
  if (!Number.isSafeInteger(videoSize) || videoSize <= 0)
    throw new Error("TIKTOK_VIDEO_SIZE_INVALID");
  if (videoSize <= MAX_CHUNK_BYTES)
    return { chunkSize: videoSize, totalChunkCount: 1 };
  return {
    chunkSize: MAX_CHUNK_BYTES,
    totalChunkCount: Math.floor(videoSize / MAX_CHUNK_BYTES),
  };
}

function scopes(value: string): string[] {
  return value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export class TikTokVideoUploadProvider implements VideoPublishProvider {
  readonly platform: ContentPlatform = "tiktok";
  readonly accountLabel = "TikTok account";

  constructor(
    private readonly input: { clientKey: string; clientSecret: string },
  ) {}

  createAuthorizationUrl(request: AuthorizationRequest): string {
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.searchParams.set("client_key", this.input.clientKey);
    url.searchParams.set("scope", SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("state", request.state);
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }> {
    const form = new URLSearchParams({
      client_key: this.input.clientKey,
      client_secret: this.input.clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    });
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const payload = await readJson(response);
    const parsed = tokenSchema.safeParse(payload);
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, payload));
    const grantedScopes = scopes(parsed.data.scope);
    if (!SCOPES.every((scope) => grantedScopes.includes(scope)))
      fail({
        category: "insufficient_permissions",
        safeMessage: "TikTok did not grant all required upload permissions.",
        retriable: false,
        mayHavePublished: false,
      });
    const tokens: PlatformTokens = {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000),
      scopes: grantedScopes,
    };
    return {
      tokens,
      account: await this.fetchAccount(tokens.accessToken),
    };
  }

  async refreshTokens(input: {
    refreshToken: string;
  }): Promise<PlatformTokens> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: this.input.clientKey,
        client_secret: this.input.clientSecret,
        grant_type: "refresh_token",
        refresh_token: input.refreshToken,
      }),
    });
    const payload = await readJson(response);
    const parsed = tokenSchema.safeParse(payload);
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, payload));
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000),
      scopes: scopes(parsed.data.scope),
    };
  }

  async revokeAuthorization(input: { accessToken: string }): Promise<void> {
    const response = await fetch(REVOKE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: this.input.clientKey,
        client_secret: this.input.clientSecret,
        token: input.accessToken,
      }),
    });
    if (!response.ok)
      fail(failureForResponse(response, await readJson(response)));
  }

  private async fetchAccount(accessToken: string): Promise<PlatformAccount> {
    const url = new URL(USER_INFO_ENDPOINT);
    url.searchParams.set("fields", "open_id,display_name");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await readJson(response);
    const parsed = userInfoSchema.safeParse(payload);
    if (!response.ok || !parsed.success || parsed.data.error.code !== "ok")
      fail(failureForResponse(response, payload));
    return {
      externalAccountId: parsed.data.data.user.open_id,
      externalAccountName: parsed.data.data.user.display_name,
      externalAccountUrl: null,
    };
  }

  async publishVideo(
    request: PublishVideoRequest,
  ): Promise<PublishVideoResult> {
    let operationId = request.providerOperationId;
    let uploadUrl = request.providerOperationSecret;
    let uploadedBytes = 0;

    if (operationId) {
      const status = await this.fetchStatus(request, operationId);
      const completed = this.completedResult(request, operationId, status);
      if (completed) return completed;
      if (status.status === "FAILED") this.failForStatus(status);
      uploadedBytes = Math.min(request.sizeBytes, status.uploaded_bytes ?? 0);
      if (!uploadUrl)
        fail({
          category: "asset_unavailable",
          safeMessage:
            "The TikTok upload session cannot be resumed. Start a new upload.",
          retriable: false,
          mayHavePublished: false,
        });
    } else {
      const initialized = await this.initializeUpload(request);
      operationId = initialized.publishId;
      uploadUrl = initialized.uploadUrl;
      await request.onProviderOperationCreated?.(operationId, uploadUrl);
    }

    await this.uploadChunks(request, operationId, uploadUrl, uploadedBytes);
    return this.waitForInbox(request, operationId);
  }

  private async initializeUpload(request: PublishVideoRequest): Promise<{
    publishId: string;
    uploadUrl: string;
  }> {
    const plan = createTikTokChunkPlan(request.sizeBytes);
    const response = await fetch(UPLOAD_INIT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.tokens.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source_info: {
          source: "FILE_UPLOAD",
          video_size: request.sizeBytes,
          chunk_size: plan.chunkSize,
          total_chunk_count: plan.totalChunkCount,
        },
      }),
    });
    const payload = await readJson(response);
    const parsed = initSchema.safeParse(payload);
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, payload));
    return {
      publishId: parsed.data.data.publish_id,
      uploadUrl: parsed.data.data.upload_url,
    };
  }

  private async uploadChunks(
    request: PublishVideoRequest,
    operationId: string,
    uploadUrl: string,
    initialUploadedBytes: number,
  ): Promise<void> {
    const plan = createTikTokChunkPlan(request.sizeBytes);
    let offset = initialUploadedBytes;
    while (offset < request.sizeBytes) {
      const nominalEnd = offset + plan.chunkSize;
      const remainingAfterNominal = request.sizeBytes - nominalEnd;
      const endExclusive =
        remainingAfterNominal > 0 && remainingAfterNominal < MIN_CHUNK_BYTES
          ? request.sizeBytes
          : Math.min(nominalEnd, request.sizeBytes);
      const sourceResponse = await fetch(request.sourceUrl, {
        headers: { Range: `bytes=${offset}-${endExclusive - 1}` },
      });
      if (!sourceResponse.ok && sourceResponse.status !== 206)
        fail({
          category: "asset_unavailable",
          safeMessage:
            "The rendered video could not be read for TikTok upload.",
          retriable: true,
          mayHavePublished: false,
        });
      const bytes = await sourceResponse.arrayBuffer();
      if (bytes.byteLength !== endExclusive - offset)
        fail({
          category: "asset_unavailable",
          safeMessage:
            "The rendered video returned an incomplete upload chunk.",
          retriable: true,
          mayHavePublished: false,
        });
      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": request.contentType,
            "Content-Length": String(bytes.byteLength),
            "Content-Range": `bytes ${offset}-${endExclusive - 1}/${request.sizeBytes}`,
          },
          body: bytes,
        });
      } catch {
        fail({
          category: "transport_ambiguous",
          safeMessage:
            "TikTok may have accepted part of the upload. VCStudio will reconcile it before another attempt.",
          retriable: true,
          mayHavePublished: false,
        });
      }
      const isFinal = endExclusive === request.sizeBytes;
      if (uploadResponse.status === 416) {
        const status = await this.fetchStatus(request, operationId);
        const reconciledOffset = Math.min(
          request.sizeBytes,
          status.uploaded_bytes ?? 0,
        );
        if (reconciledOffset > offset) {
          offset = reconciledOffset;
          continue;
        }
        fail({
          category: "provider_server_error",
          safeMessage:
            "TikTok has not confirmed the last upload chunk yet. VCStudio will reconcile it again.",
          retriable: true,
          mayHavePublished: false,
        });
      }
      if (uploadResponse.status !== (isFinal ? 201 : 206))
        fail(failureForResponse(uploadResponse, {}, false));
      offset = endExclusive;
      await request.onProgress?.(Math.floor((offset / request.sizeBytes) * 85));
    }
  }

  private async waitForInbox(
    request: PublishVideoRequest,
    operationId: string,
  ): Promise<PublishVideoResult> {
    for (let poll = 0; poll < MAX_STATUS_POLLS; poll += 1) {
      if (poll > 0) await request.waitForProcessing?.(STATUS_POLL_INTERVAL_MS);
      const status = await this.fetchStatus(request, operationId);
      const completed = this.completedResult(request, operationId, status);
      if (completed) return completed;
      if (status.status === "FAILED") this.failForStatus(status);
      await request.onProcessingProgress?.(
        Math.min(95, 86 + Math.floor((poll / MAX_STATUS_POLLS) * 9)),
      );
    }
    fail({
      category: "provider_server_error",
      safeMessage:
        "TikTok is still processing the upload. VCStudio will check it again.",
      retriable: true,
      mayHavePublished: false,
    });
  }

  private async fetchStatus(
    request: PublishVideoRequest,
    operationId: string,
  ): Promise<TikTokStatus> {
    const response = await fetch(STATUS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.tokens.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: operationId }),
    });
    const payload = await readJson(response);
    const parsed = statusSchema.safeParse(payload);
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, payload));
    return parsed.data.data;
  }

  private completedResult(
    request: PublishVideoRequest,
    operationId: string,
    status: TikTokStatus,
  ): PublishVideoResult | null {
    if (
      status.status !== "SEND_TO_USER_INBOX" &&
      status.status !== "PUBLISH_COMPLETE"
    )
      return null;
    const postId = status.publicaly_available_post_id?.[0];
    return {
      externalVideoId: postId ? String(postId) : operationId,
      externalVideoUrl: "https://www.tiktok.com/",
      uploadedBytes: request.sizeBytes,
      completionStage:
        status.status === "PUBLISH_COMPLETE" ? "published" : "inbox_delivered",
    };
  }

  private failForStatus(status: TikTokStatus): never {
    const authorizationFailure = status.fail_reason === "auth_removed";
    fail({
      category: authorizationFailure
        ? "authorization_expired"
        : "video_rejected",
      safeMessage: authorizationFailure
        ? "TikTok access was removed. Reconnect the account."
        : "TikTok rejected the video. Verify the render and try a new upload.",
      retriable: status.fail_reason === "internal",
      mayHavePublished: false,
    });
  }
}
