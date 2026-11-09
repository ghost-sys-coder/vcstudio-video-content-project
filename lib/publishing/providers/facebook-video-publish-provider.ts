import "server-only";

import { z } from "zod";
import { facebookPageIdSchema } from "@studio/contracts/publishing";
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

const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
] as const;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
});
const graphErrorSchema = z.object({
  error: z
    .object({
      code: z.number().int().optional(),
      is_transient: z.boolean().optional(),
    })
    .optional(),
});
const pageResponseSchema = z.object({
  id: facebookPageIdSchema,
  name: z.string().min(1),
  access_token: z.string().min(1),
  tasks: z.array(z.string()).optional().default([]),
});
const pagesResponseSchema = z.object({
  data: z.array(pageResponseSchema),
  paging: z
    .object({
      cursors: z.object({ after: z.string().optional() }).optional(),
      next: z.string().optional(),
    })
    .optional(),
});
const grantedPagesSchema = z.object({
  data: z.object({
    app_id: z.string(),
    is_valid: z.literal(true),
    granular_scopes: z
      .array(
        z.object({
          scope: z.string(),
          target_ids: z.array(facebookPageIdSchema).optional(),
        }),
      )
      .optional()
      .default([]),
  }),
});
const uploadStartSchema = z.object({
  upload_session_id: z.string().min(1),
  video_id: z.string().min(1),
  start_offset: z.coerce.number().int().nonnegative(),
  end_offset: z.coerce.number().int().nonnegative(),
});
const uploadTransferSchema = z.object({
  start_offset: z.coerce.number().int().nonnegative(),
  end_offset: z.coerce.number().int().nonnegative(),
});
const uploadFinishSchema = z.object({ success: z.boolean() });

export type FacebookPage = PlatformAccount & {
  pageAccessToken: string;
  tasks: string[];
};

function toFacebookPage(
  item: z.infer<typeof pageResponseSchema>,
): FacebookPage {
  return {
    externalAccountId: item.id,
    externalAccountName: item.name,
    externalAccountUrl: `https://www.facebook.com/${item.id}`,
    pageAccessToken: item.access_token,
    tasks: item.tasks,
  };
}

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
  const code = graphErrorSchema.safeParse(payload).data?.error?.code;
  const transient =
    graphErrorSchema.safeParse(payload).data?.error?.is_transient;
  if (response.status === 401 || code === 190)
    return {
      category: "authorization_expired",
      safeMessage:
        "The Facebook Page authorization expired. Reconnect the Page and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (code === 10 || code === 200)
    return {
      category: "insufficient_permissions",
      safeMessage:
        "The connected Facebook account can no longer publish to this Page.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status === 429 || [4, 17, 32, 613].includes(code ?? -1))
    return {
      category: "rate_limited",
      safeMessage: "Facebook is rate limiting requests. Try again shortly.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  if (response.status === 400 || code === 100)
    return {
      category: "invalid_metadata",
      safeMessage:
        "Facebook rejected the video details. Check them and try again.",
      retriable: false,
      mayHavePublished,
    };
  if (response.status >= 500 || transient)
    return {
      category: mayHavePublished
        ? "transport_ambiguous"
        : "provider_server_error",
      safeMessage: mayHavePublished
        ? "Facebook may have published the video but did not confirm it. Check the Page before retrying."
        : "Facebook had a server error. Try again shortly.",
      retriable: !mayHavePublished,
      mayHavePublished,
    };
  return {
    category: mayHavePublished ? "transport_ambiguous" : "provider_error",
    safeMessage: mayHavePublished
      ? "Facebook did not confirm the publication. Check the Page before retrying."
      : "The Facebook upload could not be completed.",
    retriable: false,
    mayHavePublished,
  };
}

export class FacebookVideoPublishProvider implements VideoPublishProvider {
  readonly platform: ContentPlatform = "facebook";
  readonly accountLabel = "Facebook Page";

  constructor(
    private readonly input: {
      apiVersion: string;
      appId?: string;
      appSecret?: string;
    },
  ) {}

  private graphUrl(path: string, video = false): URL {
    const host = video ? "graph-video.facebook.com" : "graph.facebook.com";
    return new URL(`https://${host}/${this.input.apiVersion}/${path}`);
  }

  createAuthorizationUrl(request: AuthorizationRequest): string {
    if (!this.input.appId)
      throw new Error("FACEBOOK_APP_ID is required for authorization.");
    const url = new URL(
      `https://www.facebook.com/${this.input.apiVersion}/dialog/oauth`,
    );
    url.searchParams.set("client_id", this.input.appId);
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", FACEBOOK_SCOPES.join(","));
    url.searchParams.set("state", request.state);
    url.searchParams.set("auth_type", "rerequest");
    return url.toString();
  }

  async exchangeUserToken(input: {
    code: string;
    redirectUri: string;
  }): Promise<PlatformTokens> {
    if (!this.input.appId || !this.input.appSecret)
      throw new Error("Meta app credentials are required for OAuth.");
    const shortUrl = this.graphUrl("oauth/access_token");
    shortUrl.search = new URLSearchParams({
      client_id: this.input.appId,
      client_secret: this.input.appSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    }).toString();
    const shortResponse = await fetch(shortUrl);
    const shortPayload = await readJson(shortResponse);
    const shortToken = tokenResponseSchema.safeParse(shortPayload);
    if (!shortResponse.ok || !shortToken.success)
      fail(failureForResponse(shortResponse, shortPayload));

    const longUrl = this.graphUrl("oauth/access_token");
    longUrl.search = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: this.input.appId,
      client_secret: this.input.appSecret,
      fb_exchange_token: shortToken.data.access_token,
    }).toString();
    const longResponse = await fetch(longUrl);
    const longPayload = await readJson(longResponse);
    const longToken = tokenResponseSchema.safeParse(longPayload);
    if (!longResponse.ok || !longToken.success)
      fail(failureForResponse(longResponse, longPayload));
    return {
      accessToken: longToken.data.access_token,
      refreshToken: null,
      expiresAt: longToken.data.expires_in
        ? new Date(Date.now() + longToken.data.expires_in * 1000)
        : null,
      scopes: [...FACEBOOK_SCOPES],
    };
  }

  async listPages(userAccessToken: string): Promise<FacebookPage[]> {
    const pages = new Map<string, FacebookPage>();
    const cursors = new Set<string>();
    let after: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const url = this.graphUrl("me/accounts");
      url.searchParams.set("fields", "id,name,access_token,tasks");
      url.searchParams.set("limit", "100");
      if (after) url.searchParams.set("after", after);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${userAccessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const payload = await readJson(response);
      const parsed = pagesResponseSchema.safeParse(payload);
      if (!response.ok || !parsed.success)
        fail(failureForResponse(response, payload));
      for (const item of parsed.data.data)
        pages.set(item.id, toFacebookPage(item));
      after = parsed.data.paging?.cursors?.after;
      // A cursor can exist on the final page. Never follow paging.next itself:
      // rebuild the fixed Graph URL instead of trusting a token-bearing URL.
      if (!parsed.data.paging?.next || !after || cursors.has(after)) break;
      cursors.add(after);
    }

    // Business Login's consent targets can include Pages omitted by /me/accounts.
    // They are hints, not authority: each still needs its own Page token lookup.
    const grantedIds = await this.grantedPageIds(userAccessToken);
    const missingIds = grantedIds.filter((id) => !pages.has(id)).slice(0, 20);
    for (let start = 0; start < missingIds.length; start += 4) {
      const results = await Promise.allSettled(
        missingIds
          .slice(start, start + 4)
          .map((pageId) => this.getPage({ userAccessToken, pageId })),
      );
      for (const result of results) {
        if (result.status === "fulfilled")
          pages.set(result.value.externalAccountId, result.value);
        else console.warn("A consented Facebook Page could not be verified.");
      }
    }
    return [...pages.values()];
  }

  private async grantedPageIds(userAccessToken: string): Promise<string[]> {
    if (!this.input.appId || !this.input.appSecret) return [];
    try {
      const url = this.graphUrl("debug_token");
      url.searchParams.set("input_token", userAccessToken);
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.input.appId}|${this.input.appSecret}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      const parsed = grantedPagesSchema.safeParse(await readJson(response));
      if (
        !response.ok ||
        !parsed.success ||
        parsed.data.data.app_id !== this.input.appId
      )
        throw new Error("FACEBOOK_PAGE_GRANTS_UNAVAILABLE");
      return [
        ...new Set(
          parsed.data.data.granular_scopes
            .filter((grant) => grant.scope === "pages_show_list")
            .flatMap((grant) => grant.target_ids ?? []),
        ),
      ];
    } catch {
      // Keep already-verified Pages usable and offer direct lookup in the UI.
      // Do not log a fetch error: its URL can contain the user token.
      console.warn("Facebook Page grant discovery is unavailable.");
      return [];
    }
  }

  async getPage(input: {
    userAccessToken: string;
    pageId: string;
  }): Promise<FacebookPage> {
    const pageId = facebookPageIdSchema.parse(input.pageId);
    const url = this.graphUrl(pageId);
    url.searchParams.set("fields", "id,name,access_token");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${input.userAccessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await readJson(response);
    const parsed = pageResponseSchema.safeParse(payload);
    if (!response.ok || !parsed.success || parsed.data.id !== pageId) {
      const failure = failureForResponse(response, payload);
      if (
        failure.category === "authorization_expired" ||
        failure.category === "rate_limited" ||
        failure.category === "provider_server_error"
      )
        fail(failure);
      fail({
        category: "insufficient_permissions",
        safeMessage:
          "Facebook did not grant access to this Page. Check its Page ID, select it in Facebook's Edit settings, and confirm your account has permission to create Page content. Then reconnect and try again.",
        retriable: false,
        mayHavePublished: false,
      });
    }
    return toFacebookPage(parsed.data);
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }> {
    const userTokens = await this.exchangeUserToken(input);
    const pages = await this.listPages(userTokens.accessToken);
    if (pages.length !== 1)
      fail({
        category: "insufficient_permissions",
        safeMessage:
          pages.length === 0
            ? "No manageable Facebook Pages were found for this account."
            : "Select the Facebook Page to connect before publishing.",
        retriable: false,
        mayHavePublished: false,
      });
    const [page] = pages;
    return {
      tokens: {
        accessToken: page.pageAccessToken,
        refreshToken: null,
        expiresAt: null,
        scopes: userTokens.scopes,
      },
      account: page,
    };
  }

  async refreshTokens(): Promise<PlatformTokens> {
    fail({
      category: "authorization_expired",
      safeMessage: "Reconnect the Facebook Page to renew authorization.",
      retriable: false,
      mayHavePublished: false,
    });
  }

  async publishVideo(
    request: PublishVideoRequest,
  ): Promise<PublishVideoResult> {
    if (request.visibility === "unlisted")
      fail({
        category: "invalid_metadata",
        safeMessage:
          "Facebook Page videos can be public or saved as a draft, not unlisted.",
        retriable: false,
        mayHavePublished: false,
      });
    const endpoint = this.graphUrl(
      `${encodeURIComponent(request.account.externalAccountId)}/videos`,
      true,
    );
    const headers = { Authorization: `Bearer ${request.tokens.accessToken}` };
    const startBody = new URLSearchParams({
      upload_phase: "start",
      file_size: String(request.sizeBytes),
    });
    const startResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: startBody,
    });
    const startPayload = await readJson(startResponse);
    const start = uploadStartSchema.safeParse(startPayload);
    if (!startResponse.ok || !start.success)
      fail(failureForResponse(startResponse, startPayload));

    let offset = start.data.start_offset;
    let endOffset = start.data.end_offset;
    while (offset < request.sizeBytes) {
      if (endOffset <= offset)
        fail({
          category: "provider_error",
          safeMessage: "Facebook returned an invalid upload range.",
          retriable: false,
          mayHavePublished: false,
        });
      const source = await fetch(request.sourceUrl, {
        headers: {
          Range: `bytes=${offset}-${Math.min(endOffset, request.sizeBytes) - 1}`,
        },
      });
      if (!source.ok)
        fail({
          category: "asset_unavailable",
          safeMessage:
            "The rendered video could not be read. Re-render and try again.",
          retriable: false,
          mayHavePublished: false,
        });
      const chunk = await source.blob();
      const transferBody = new FormData();
      transferBody.set("upload_phase", "transfer");
      transferBody.set("upload_session_id", start.data.upload_session_id);
      transferBody.set("start_offset", String(offset));
      transferBody.set("video_file_chunk", chunk, "video.mp4");
      const transferResponse = await fetch(endpoint, {
        method: "POST",
        headers,
        body: transferBody,
      });
      const transferPayload = await readJson(transferResponse);
      const transfer = uploadTransferSchema.safeParse(transferPayload);
      if (!transferResponse.ok || !transfer.success)
        fail(failureForResponse(transferResponse, transferPayload));
      if (transfer.data.start_offset <= offset)
        fail({
          category: "provider_error",
          safeMessage: "Facebook did not advance the upload.",
          retriable: false,
          mayHavePublished: false,
        });
      offset = transfer.data.start_offset;
      endOffset = transfer.data.end_offset;
      await request.onProgress?.(
        Math.min(99, Math.floor((offset / request.sizeBytes) * 100)),
      );
    }

    const finishBody = new URLSearchParams({
      upload_phase: "finish",
      upload_session_id: start.data.upload_session_id,
      title: request.title,
      description: request.description,
      published: request.visibility === "public" ? "true" : "false",
    });
    let finishResponse: Response;
    try {
      finishResponse = await fetch(endpoint, {
        method: "POST",
        headers,
        body: finishBody,
      });
    } catch {
      fail({
        category: "transport_ambiguous",
        safeMessage:
          "Facebook may have published the video but did not confirm it. Check the Page before retrying.",
        retriable: false,
        mayHavePublished: true,
      });
    }
    const finishPayload = await readJson(finishResponse);
    const finish = uploadFinishSchema.safeParse(finishPayload);
    if (!finishResponse.ok || !finish.success || !finish.data.success)
      fail(failureForResponse(finishResponse, finishPayload, true));
    await request.onProgress?.(100);
    return {
      externalVideoId: start.data.video_id,
      externalVideoUrl: `https://www.facebook.com/${encodeURIComponent(request.account.externalAccountId)}/videos/${encodeURIComponent(start.data.video_id)}`,
      uploadedBytes: request.sizeBytes,
      completionStage: "published",
    };
  }
}
