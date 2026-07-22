import "server-only";

import type { ContentPlatform } from "@/db/schema";
import {
  YOUTUBE_DESCRIPTION_MAX_LENGTH,
  YOUTUBE_TITLE_MAX_LENGTH,
} from "@/lib/publishing/platform-limits";
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

const AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const CHANNELS_ENDPOINT =
  "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
const RESUMABLE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

/**
 * `youtube.upload` is the narrowest scope that can insert a video;
 * `youtube.readonly` is needed only to resolve which channel was authorized so
 * the UI can name it. No broader scope is requested.
 */
const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

/** Upload in 8 MiB chunks so progress is observable and a stall is bounded. */
const CHUNK_SIZE_BYTES = 8 * 1024 * 1024;

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

function fail(failure: PublishFailure): never {
  throw new PublishProviderError(failure);
}

/**
 * Map a Google HTTP status onto the shared taxonomy. Google's own error bodies
 * can contain quota project ids and internal hints, so only a curated message
 * is surfaced; the raw body goes to the caller's logger, never to the user.
 */
function failureForStatus(status: number, reason: string): PublishFailure {
  if (status === 401)
    return {
      category: "authorization_expired",
      safeMessage:
        "The YouTube connection is no longer authorized. Reconnect the channel and try again.",
      retriable: false,
      mayHavePublished: false,
    };
  if (status === 403) {
    const quota = reason.includes("quota") || reason.includes("uploadLimit");
    return quota
      ? {
          category: "quota_exceeded",
          safeMessage:
            "The channel's YouTube upload quota is exhausted. Try again after it resets.",
          retriable: false,
          mayHavePublished: false,
        }
      : {
          category: "insufficient_permissions",
          safeMessage:
            "This Google account is not permitted to upload to that channel.",
          retriable: false,
          mayHavePublished: false,
        };
  }
  if (status === 429)
    return {
      category: "rate_limited",
      safeMessage: "YouTube is rate limiting uploads. Try again shortly.",
      retriable: true,
      mayHavePublished: false,
    };
  if (status === 400)
    return {
      category: "invalid_metadata",
      safeMessage:
        "YouTube rejected the video details. Check the title and description and try again.",
      retriable: false,
      mayHavePublished: false,
    };
  if (status >= 500)
    return {
      category: "provider_server_error",
      safeMessage: "YouTube had a server error. Try again shortly.",
      retriable: true,
      mayHavePublished: false,
    };
  return {
    category: "provider_error",
    safeMessage: "The upload could not be completed.",
    retriable: false,
    mayHavePublished: false,
  };
}

export class YouTubeVideoPublishProvider implements VideoPublishProvider {
  readonly platform: ContentPlatform = "youtube";
  readonly accountLabel = "YouTube channel";

  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(input: { clientId: string; clientSecret: string }) {
    this.clientId = input.clientId;
    this.clientSecret = input.clientSecret;
  }

  createAuthorizationUrl(request: AuthorizationRequest): string {
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES.join(" "));
    url.searchParams.set("state", request.state);
    // `offline` + `consent` guarantee a refresh token even on re-authorization;
    // without them Google omits it after the first grant and the connection
    // silently dies when the access token expires.
    url.searchParams.set("access_type", "offline");
    // Account selection matters when a workspace connects more than one
    // channel; consent alone may silently reuse the previous Google account.
    url.searchParams.set("prompt", "consent select_account");
    url.searchParams.set("include_granted_scopes", "true");
    return url.toString();
  }

  private async requestTokens(
    body: Record<string, string>,
  ): Promise<PlatformTokens> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
    const payload = (await response.json().catch(() => ({}))) as TokenResponse;
    if (!response.ok || !payload.access_token)
      fail(failureForStatus(response.status, payload.error ?? ""));

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? null,
      expiresAt: payload.expires_in
        ? new Date(Date.now() + payload.expires_in * 1000)
        : null,
      scopes: payload.scope ? payload.scope.split(" ") : SCOPES,
    };
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }> {
    const tokens = await this.requestTokens({
      code: input.code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    });
    return { tokens, account: await this.fetchAccount(tokens.accessToken) };
  }

  async refreshTokens(input: {
    refreshToken: string;
  }): Promise<PlatformTokens> {
    const tokens = await this.requestTokens({
      refresh_token: input.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: "refresh_token",
    });
    // A refresh response omits the refresh token; keep the stored one.
    return { ...tokens, refreshToken: tokens.refreshToken ?? null };
  }

  private async fetchAccount(accessToken: string): Promise<PlatformAccount> {
    const response = await fetch(CHANNELS_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok)
      fail(failureForStatus(response.status, await response.text()));

    const payload = (await response.json()) as {
      items?: {
        id?: string;
        snippet?: { title?: string; customUrl?: string };
      }[];
    };
    const channel = payload.items?.[0];
    if (!channel?.id)
      fail({
        category: "insufficient_permissions",
        safeMessage:
          "This Google account has no YouTube channel. Create one, then reconnect.",
        retriable: false,
        mayHavePublished: false,
      });

    return {
      externalAccountId: channel.id,
      externalAccountName: channel.snippet?.title ?? "YouTube channel",
      externalAccountUrl: `https://www.youtube.com/channel/${channel.id}`,
    };
  }

  async publishVideo(
    request: PublishVideoRequest,
  ): Promise<PublishVideoResult> {
    const uploadUrl = await this.startResumableSession(request);
    return this.uploadInChunks(request, uploadUrl);
  }

  /** Step 1: register the metadata and get a session URL to stream bytes to. */
  private async startResumableSession(
    request: PublishVideoRequest,
  ): Promise<string> {
    const response = await fetch(RESUMABLE_UPLOAD_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${request.tokens.accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": String(request.sizeBytes),
        "X-Upload-Content-Type": request.contentType,
      },
      body: JSON.stringify({
        snippet: {
          title: request.title.slice(0, YOUTUBE_TITLE_MAX_LENGTH),
          description: request.description.slice(
            0,
            YOUTUBE_DESCRIPTION_MAX_LENGTH,
          ),
          tags: request.tags,
        },
        status: {
          privacyStatus: request.visibility,
          selfDeclaredMadeForKids: false,
        },
      }),
    });
    if (!response.ok)
      fail(failureForStatus(response.status, await response.text()));

    const uploadUrl = response.headers.get("location");
    if (!uploadUrl)
      fail({
        category: "provider_error",
        safeMessage: "YouTube did not return an upload session.",
        retriable: true,
        mayHavePublished: false,
      });
    return uploadUrl;
  }

  /**
   * Step 2: stream the render from its signed URL to YouTube in chunks, ranging
   * the source so the whole file never has to be held in memory.
   */
  private async uploadInChunks(
    request: PublishVideoRequest,
    uploadUrl: string,
  ): Promise<PublishVideoResult> {
    let offset = 0;
    while (offset < request.sizeBytes) {
      const end = Math.min(offset + CHUNK_SIZE_BYTES, request.sizeBytes) - 1;
      const source = await fetch(request.sourceUrl, {
        headers: { Range: `bytes=${offset}-${end}` },
      });
      if (!source.ok || !source.body)
        fail({
          category: "asset_unavailable",
          safeMessage:
            "The rendered video could not be read. Re-render and try again.",
          retriable: false,
          mayHavePublished: false,
        });
      const chunk = new Uint8Array(await source.arrayBuffer());

      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunk.byteLength),
          "Content-Range": `bytes ${offset}-${offset + chunk.byteLength - 1}/${request.sizeBytes}`,
        },
        body: chunk,
      });

      // 308 = chunk accepted, more expected. 200/201 = upload complete.
      if (response.status === 308) {
        offset += chunk.byteLength;
        await request.onProgress?.(
          Math.min(99, Math.floor((offset / request.sizeBytes) * 100)),
        );
        continue;
      }
      if (response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          id?: string;
        };
        if (!payload.id)
          fail({
            category: "transport_ambiguous",
            safeMessage:
              "YouTube accepted the upload but did not confirm a video id. Check the channel before retrying.",
            retriable: false,
            mayHavePublished: true,
          });
        await request.onProgress?.(100);
        return {
          externalVideoId: payload.id,
          externalVideoUrl: `https://www.youtube.com/watch?v=${payload.id}`,
          uploadedBytes: request.sizeBytes,
        };
      }
      fail(failureForStatus(response.status, await response.text()));
    }

    fail({
      category: "transport_ambiguous",
      safeMessage:
        "The upload finished without a confirmation from YouTube. Check the channel before retrying.",
      retriable: false,
      mayHavePublished: true,
    });
  }
}
