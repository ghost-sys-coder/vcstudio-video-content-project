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

const AUTHORIZATION_ENDPOINT = "https://www.instagram.com/oauth/authorize";
const TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token";
const GRAPH_ORIGIN = "https://graph.instagram.com";
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;
const PROCESSING_POLL_INTERVAL_MS = 5000;
const MAX_PROCESSING_POLLS = 120;

const shortTokenSchema = z.object({
  access_token: z.string().min(1),
});
const longTokenSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive(),
});
const accountSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
});
const containerSchema = z.object({ id: z.string().min(1) });
const containerStatusSchema = z.object({
  status_code: z.enum([
    "EXPIRED",
    "ERROR",
    "FINISHED",
    "IN_PROGRESS",
    "PUBLISHED",
  ]),
  status: z.string().optional(),
});
const publishedMediaSchema = z.object({ id: z.string().min(1) });
const permalinkSchema = z.object({ permalink: z.url() });
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

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function readExactInstagramUserId(payloadText: string): string | null {
  const match = payloadText.match(/"user_id"\s*:\s*(?:"(\d+)"|(\d+))/);
  return match?.[1] ?? match?.[2] ?? null;
}

function failureForResponse(
  response: Response,
  payload: unknown,
  mayHavePublished = false,
): PublishFailure {
  const parsed = graphErrorSchema.safeParse(payload);
  const error = parsed.success ? parsed.data.error : undefined;
  if (response.status === 401 || error?.code === 190)
    return {
      category: "authorization_expired",
      safeMessage:
        "The Instagram authorization expired. Reconnect the account and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (error?.code === 10 || error?.code === 200)
    return {
      category: "insufficient_permissions",
      safeMessage:
        "The Instagram account no longer grants permission to publish Reels.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 429 || [4, 17, 32, 613].includes(error?.code ?? -1))
    return {
      category: "rate_limited",
      safeMessage: "Instagram is rate limiting publishing. Try again later.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  if (response.status === 400 || error?.code === 100)
    return {
      category: "invalid_metadata",
      safeMessage:
        "Instagram rejected the Reel details or video format. Review the caption and render.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status >= 500 || error?.is_transient)
    return {
      category: mayHavePublished
        ? "transport_ambiguous"
        : "provider_server_error",
      safeMessage: mayHavePublished
        ? "Instagram may have published the Reel but did not confirm it. Check the account before retrying."
        : "Instagram had a server error. Try again later.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  return {
    category: mayHavePublished ? "transport_ambiguous" : "provider_error",
    safeMessage: mayHavePublished
      ? "Instagram did not confirm the Reel publication. Check the account before retrying."
      : "The Instagram Reel could not be published.",
    retriable: false,
    mayHavePublished,
  };
}

export class InstagramVideoPublishProvider implements VideoPublishProvider {
  readonly platform: ContentPlatform = "instagram";
  readonly accountLabel = "Instagram account";

  constructor(
    private readonly input: {
      apiVersion: string;
      appId?: string;
      appSecret?: string;
    },
  ) {}

  private graphUrl(path: string, versioned = true): URL {
    return new URL(
      versioned
        ? `${GRAPH_ORIGIN}/${this.input.apiVersion}/${path}`
        : `${GRAPH_ORIGIN}/${path}`,
    );
  }

  createAuthorizationUrl(request: AuthorizationRequest): string {
    if (!this.input.appId)
      throw new Error("INSTAGRAM_APP_ID is required for authorization.");
    const url = new URL(AUTHORIZATION_ENDPOINT);
    url.searchParams.set("enable_fb_login", "0");
    url.searchParams.set("force_authentication", "1");
    url.searchParams.set("client_id", this.input.appId);
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPES.join(","));
    url.searchParams.set("state", request.state);
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }> {
    if (!this.input.appId || !this.input.appSecret)
      throw new Error("Instagram app credentials are required for OAuth.");
    const form = new FormData();
    form.set("client_id", this.input.appId);
    form.set("client_secret", this.input.appSecret);
    form.set("grant_type", "authorization_code");
    form.set("redirect_uri", input.redirectUri);
    form.set("code", input.code);
    const shortResponse = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      body: form,
    });
    const shortPayloadText = await shortResponse.text();
    const shortPayload: unknown = (() => {
      try {
        return JSON.parse(shortPayloadText) as unknown;
      } catch {
        return {};
      }
    })();
    const short = shortTokenSchema.safeParse(shortPayload);
    const instagramUserId = readExactInstagramUserId(shortPayloadText);
    if (!shortResponse.ok || !short.success || !instagramUserId)
      fail(failureForResponse(shortResponse, shortPayload));

    const longUrl = this.graphUrl("access_token", false);
    longUrl.search = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: this.input.appSecret,
      access_token: short.data.access_token,
    }).toString();
    const longResponse = await fetch(longUrl);
    const longPayload = await readJson(longResponse);
    const long = longTokenSchema.safeParse(longPayload);
    if (!longResponse.ok || !long.success)
      fail(failureForResponse(longResponse, longPayload));
    const tokens: PlatformTokens = {
      accessToken: long.data.access_token,
      // Instagram refreshes the long-lived access token itself.
      refreshToken: long.data.access_token,
      expiresAt: new Date(Date.now() + long.data.expires_in * 1000),
      scopes: [...SCOPES],
    };
    return {
      tokens,
      account: await this.fetchAccount(instagramUserId, tokens.accessToken),
    };
  }

  async refreshTokens(input: {
    refreshToken: string;
  }): Promise<PlatformTokens> {
    const url = this.graphUrl("refresh_access_token", false);
    url.search = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: input.refreshToken,
    }).toString();
    const response = await fetch(url);
    const payload = await readJson(response);
    const parsed = longTokenSchema.safeParse(payload);
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, payload));
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.access_token,
      expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000),
      scopes: [...SCOPES],
    };
  }

  private async fetchAccount(
    userId: string,
    accessToken: string,
  ): Promise<PlatformAccount> {
    const url = this.graphUrl(encodeURIComponent(userId));
    url.searchParams.set("fields", "id,username");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await readJson(response);
    const account = accountSchema.safeParse(payload);
    if (!response.ok || !account.success)
      fail(failureForResponse(response, payload));
    return {
      externalAccountId: account.data.id,
      externalAccountName: `@${account.data.username}`,
      externalAccountUrl: `https://www.instagram.com/${encodeURIComponent(account.data.username)}/`,
    };
  }

  async publishVideo(
    request: PublishVideoRequest,
  ): Promise<PublishVideoResult> {
    if (request.caption === null || request.shareToFeed === null)
      fail({
        category: "invalid_metadata",
        safeMessage: "The Instagram caption or feed setting is missing.",
        retriable: false,
        mayHavePublished: false,
      });
    const operationId =
      request.providerOperationId ?? (await this.createContainer(request));
    if (!request.providerOperationId)
      await request.onProviderOperationCreated?.(operationId);
    await this.waitForContainer(request, operationId);

    const publishUrl = this.graphUrl(
      `${encodeURIComponent(request.account.externalAccountId)}/media_publish`,
    );
    const publishBody = new URLSearchParams({ creation_id: operationId });
    let publishResponse: Response;
    try {
      publishResponse = await fetch(publishUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${request.tokens.accessToken}` },
        body: publishBody,
      });
    } catch {
      fail({
        category: "transport_ambiguous",
        safeMessage:
          "Instagram may have published the Reel but did not confirm it. Check the account before retrying.",
        retriable: false,
        mayHavePublished: true,
      });
    }
    const publishPayload = await readJson(publishResponse);
    const published = publishedMediaSchema.safeParse(publishPayload);
    if (!publishResponse.ok || !published.success)
      fail(failureForResponse(publishResponse, publishPayload, true));

    const permalinkUrl = this.graphUrl(encodeURIComponent(published.data.id));
    permalinkUrl.searchParams.set("fields", "permalink");
    const permalinkResponse = await fetch(permalinkUrl, {
      headers: { Authorization: `Bearer ${request.tokens.accessToken}` },
    });
    const permalinkPayload = await readJson(permalinkResponse);
    const permalink = permalinkSchema.safeParse(permalinkPayload);
    await request.onProgress?.(100);
    return {
      externalVideoId: published.data.id,
      externalVideoUrl:
        permalinkResponse.ok && permalink.success
          ? permalink.data.permalink
          : "https://www.instagram.com/",
      uploadedBytes: request.sizeBytes,
      completionStage: "published",
    };
  }

  private async createContainer(request: PublishVideoRequest): Promise<string> {
    const url = this.graphUrl(
      `${encodeURIComponent(request.account.externalAccountId)}/media`,
    );
    const body = new URLSearchParams({
      media_type: "REELS",
      video_url: request.sourceUrl,
      caption: request.caption ?? "",
      share_to_feed: request.shareToFeed ? "true" : "false",
    });
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${request.tokens.accessToken}` },
      body,
    });
    const payload = await readJson(response);
    const parsed = containerSchema.safeParse(payload);
    if (!response.ok || !parsed.success)
      fail(failureForResponse(response, payload));
    return parsed.data.id;
  }

  private async waitForContainer(
    request: PublishVideoRequest,
    operationId: string,
  ): Promise<void> {
    for (let poll = 0; poll < MAX_PROCESSING_POLLS; poll += 1) {
      if (poll > 0) {
        if (request.waitForProcessing)
          await request.waitForProcessing(PROCESSING_POLL_INTERVAL_MS);
        else await Promise.resolve();
      }
      const url = this.graphUrl(encodeURIComponent(operationId));
      url.searchParams.set("fields", "status_code,status");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${request.tokens.accessToken}` },
      });
      const payload = await readJson(response);
      const status = containerStatusSchema.safeParse(payload);
      if (!response.ok || !status.success)
        fail(failureForResponse(response, payload));
      if (status.data.status_code === "FINISHED") return;
      if (status.data.status_code === "PUBLISHED")
        fail({
          category: "transport_ambiguous",
          safeMessage:
            "Instagram already processed this Reel but its media id was not confirmed. Check the account before retrying.",
          retriable: false,
          mayHavePublished: true,
        });
      if (
        status.data.status_code === "ERROR" ||
        status.data.status_code === "EXPIRED"
      )
        fail({
          category: "video_rejected",
          safeMessage:
            "Instagram could not process the Reel. Verify the video format and render again.",
          retriable: false,
          mayHavePublished: false,
        });
      await request.onProcessingProgress?.(
        Math.min(85, 20 + Math.floor((poll / MAX_PROCESSING_POLLS) * 65)),
      );
    }
    fail({
      category: "provider_server_error",
      safeMessage: "Instagram is still processing the Reel. Try again later.",
      retriable: true,
      mayHavePublished: false,
    });
  }
}
