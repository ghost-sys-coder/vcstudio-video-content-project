import "server-only";

import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import type { ContentPlatform } from "@/db/schema";
import type {
  AuthorizationRequest,
  PlatformAccount,
  PlatformOAuthProvider,
  PlatformTokens,
} from "@/lib/publishing/platform-oauth-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

/**
 * `tweet.write` is what permits posting and `media.write` what permits attaching
 * anything to it — the v2 media endpoints reject a token without it, which reads
 * as a permission error on the *post* rather than on the upload.
 * `offline.access` is the only reason a refresh token is issued at all; without
 * it an X connection dies in two hours and every scheduled post after that
 * fails, so it is not optional here.
 */
const TWITTER_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "media.write",
  "offline.access",
] as const;

const AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const REVOKE_URL = "https://api.x.com/2/oauth2/revoke";
const USERS_ME_URL = "https://api.x.com/2/users/me";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
});

const usersMeSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    name: z.string().optional(),
    username: z.string().min(1),
  }),
});

function fail(message: string, retriable: boolean): never {
  throw new PublishProviderError({
    category: retriable ? "provider_server_error" : "provider_error",
    safeMessage: message,
    retriable,
    mayHavePublished: false,
  });
}

/**
 * Connects an X account through OAuth 2.0 with PKCE.
 *
 * X is the first platform here that **requires PKCE**, which is awkward for a
 * stateless callback: the `code_verifier` is created before the redirect and
 * needed after it, so something has to carry it across. Rather than adding a
 * cookie or a database row for a value that lives for one round trip, it is
 * derived — `HMAC-SHA256(clientSecret, state)` — so both halves of the flow
 * recompute the same verifier from the signed state they already have.
 *
 * That keeps the property PKCE exists for. An attacker who intercepts the
 * authorization code still cannot redeem it, because deriving the verifier needs
 * the client secret, which never leaves the server. The secret is a safe HMAC
 * key here specifically because X is the only party that ever receives the
 * result and X already holds the secret, so nothing is disclosed that the
 * recipient did not have.
 *
 * Constructor takes only the client credentials, deliberately: the Trigger.dev
 * worker builds this provider to refresh expiring tokens, and it has no access
 * to web-only configuration.
 */
export class TwitterOAuthProvider implements PlatformOAuthProvider {
  readonly platform: ContentPlatform = "twitter";
  readonly accountLabel = "X account";

  constructor(
    private readonly input: { clientId: string; clientSecret: string },
  ) {}

  /** Deterministic per-flow PKCE verifier. See the class comment. */
  private codeVerifier(state: string): string {
    return createHmac("sha256", this.input.clientSecret)
      .update(`pkce.v1.${state}`)
      .digest("base64url");
  }

  /**
   * X permits confidential clients to authenticate at the token endpoint with
   * HTTP Basic, which keeps the secret out of the request body.
   */
  private basicAuthorization(): string {
    const encoded = Buffer.from(
      `${this.input.clientId}:${this.input.clientSecret}`,
      "utf8",
    ).toString("base64");
    return `Basic ${encoded}`;
  }

  createAuthorizationUrl(request: AuthorizationRequest): string {
    const challenge = createHash("sha256")
      .update(this.codeVerifier(request.state))
      .digest("base64url");
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.input.clientId);
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("state", request.state);
    url.searchParams.set("scope", TWITTER_SCOPES.join(" "));
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
    state?: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }> {
    // Without the originating state there is no verifier, and X will reject the
    // exchange. Caught here so the failure names the cause instead of arriving
    // as an opaque 400 from the platform.
    if (!input.state)
      fail("The X authorization is missing its verification state.", false);

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Authorization: this.basicAuthorization(),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: this.input.clientId,
        code_verifier: this.codeVerifier(input.state),
      }),
    });
    const parsed = tokenResponseSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    if (!response.ok || !parsed.success)
      fail("X refused the authorization.", response.status >= 500);

    const profile = await fetch(USERS_ME_URL, {
      headers: { Authorization: `Bearer ${parsed.data.access_token}` },
    });
    const info = usersMeSchema.safeParse(
      await profile.json().catch(() => ({})),
    );
    if (!profile.ok || !info.success)
      fail("The X profile could not be read.", profile.status >= 500);

    return {
      tokens: {
        accessToken: parsed.data.access_token,
        // Only present when `offline.access` was granted. Absent means this
        // connection expires in ~2 hours and the member must reconnect.
        refreshToken: parsed.data.refresh_token ?? null,
        expiresAt: parsed.data.expires_in
          ? new Date(Date.now() + parsed.data.expires_in * 1000)
          : null,
        scopes: parsed.data.scope?.split(/[\s,]+/).filter(Boolean) ?? [
          ...TWITTER_SCOPES,
        ],
      },
      account: {
        externalAccountId: info.data.data.id,
        externalAccountName: info.data.data.name ?? info.data.data.username,
        externalAccountUrl: `https://x.com/${info.data.data.username}`,
      },
    };
  }

  async refreshTokens(input: {
    refreshToken: string;
  }): Promise<PlatformTokens> {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Authorization: this.basicAuthorization(),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: input.refreshToken,
        client_id: this.input.clientId,
      }),
    });
    const parsed = tokenResponseSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    if (!response.ok || !parsed.success)
      throw new PublishProviderError({
        category: "authorization_expired",
        safeMessage: "Reconnect X to renew authorization.",
        retriable: false,
        mayHavePublished: false,
      });
    return {
      accessToken: parsed.data.access_token,
      // X rotates refresh tokens: the old one stops working the moment this
      // succeeds, so keeping the previous value would break the *next* refresh.
      refreshToken: parsed.data.refresh_token ?? input.refreshToken,
      expiresAt: parsed.data.expires_in
        ? new Date(Date.now() + parsed.data.expires_in * 1000)
        : null,
      scopes: parsed.data.scope?.split(/[\s,]+/).filter(Boolean) ?? [
        ...TWITTER_SCOPES,
      ],
    };
  }

  async revokeAuthorization(input: { accessToken: string }): Promise<void> {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        Authorization: this.basicAuthorization(),
      },
      body: new URLSearchParams({
        token: input.accessToken,
        token_type_hint: "access_token",
        client_id: this.input.clientId,
      }),
      // A failed revoke must not block disconnecting: the row is removed either
      // way, and leaving a user unable to disconnect is worse than leaving a
      // token X will expire on its own.
    }).catch(() => undefined);
  }
}
