import "server-only";

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
 * Member-level LinkedIn scopes.
 *
 * `w_member_social` is what actually permits posting; `openid`/`profile` are
 * only there to read back the member's id and name for the connection row.
 * Posting as an **organization page** needs `w_organization_social` and the
 * Community Management API product, which is a separate LinkedIn approval — see
 * the README's limitations.
 */
const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"] as const;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  refresh_token_expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
});

const userInfoSchema = z.object({
  sub: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
});

function fail(message: string, retriable: boolean): never {
  throw new PublishProviderError({
    category: retriable ? "provider_server_error" : "provider_error",
    safeMessage: message,
    retriable,
    mayHavePublished: false,
  });
}

export class LinkedInOAuthProvider implements PlatformOAuthProvider {
  readonly platform: ContentPlatform = "linkedin";
  readonly accountLabel = "LinkedIn profile";

  constructor(
    private readonly input: { clientId: string; clientSecret: string },
  ) {}

  createAuthorizationUrl(request: AuthorizationRequest): string {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.input.clientId);
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("state", request.state);
    url.searchParams.set("scope", LINKEDIN_SCOPES.join(" "));
    return url.toString();
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }> {
    const response = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: input.code,
          redirect_uri: input.redirectUri,
          client_id: this.input.clientId,
          client_secret: this.input.clientSecret,
        }),
      },
    );
    const parsed = tokenResponseSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    if (!response.ok || !parsed.success)
      fail("LinkedIn refused the authorization.", response.status >= 500);

    const profile = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${parsed.data.access_token}` },
    });
    const info = userInfoSchema.safeParse(
      await profile.json().catch(() => ({})),
    );
    if (!profile.ok || !info.success)
      fail("The LinkedIn profile could not be read.", profile.status >= 500);

    return {
      tokens: {
        accessToken: parsed.data.access_token,
        // Only approved apps receive a refresh token; without one, the member
        // has to reconnect when the access token expires (~60 days).
        refreshToken: parsed.data.refresh_token ?? null,
        expiresAt: parsed.data.expires_in
          ? new Date(Date.now() + parsed.data.expires_in * 1000)
          : null,
        scopes: parsed.data.scope?.split(/[\s,]+/).filter(Boolean) ?? [
          ...LINKEDIN_SCOPES,
        ],
      },
      account: {
        // The member URN this app posts as. Stored bare; the provider prefixes
        // `urn:li:person:` when it builds a post.
        externalAccountId: info.data.sub,
        externalAccountName: info.data.name ?? "LinkedIn member",
        externalAccountUrl: "https://www.linkedin.com/feed/",
      },
    };
  }

  async refreshTokens(input: {
    refreshToken: string;
  }): Promise<PlatformTokens> {
    const response = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: input.refreshToken,
          client_id: this.input.clientId,
          client_secret: this.input.clientSecret,
        }),
      },
    );
    const parsed = tokenResponseSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    if (!response.ok || !parsed.success)
      throw new PublishProviderError({
        category: "authorization_expired",
        safeMessage: "Reconnect LinkedIn to renew authorization.",
        retriable: false,
        mayHavePublished: false,
      });
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token ?? input.refreshToken,
      expiresAt: parsed.data.expires_in
        ? new Date(Date.now() + parsed.data.expires_in * 1000)
        : null,
      scopes: [...LINKEDIN_SCOPES],
    };
  }
}
