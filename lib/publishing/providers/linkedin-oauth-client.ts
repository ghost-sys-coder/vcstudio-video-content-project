import "server-only";

import { z } from "zod";
import type {
  AuthorizationRequest,
  PlatformTokens,
} from "@/lib/publishing/platform-oauth-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
});

/** Shared token protocol; profile identity and Page discovery stay separate. */
export class LinkedInOAuthClient {
  constructor(
    private readonly credentials: {
      clientId: string;
      clientSecret: string;
      scopes: readonly string[];
      requiredScopes?: readonly string[];
    },
  ) {}

  createAuthorizationUrl(request: AuthorizationRequest): string {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.credentials.clientId);
    url.searchParams.set("redirect_uri", request.redirectUri);
    url.searchParams.set("state", request.state);
    url.searchParams.set("scope", this.credentials.scopes.join(" "));
    return url.toString();
  }

  private async requestTokens(
    values: Record<string, string>,
    refreshing: boolean,
  ): Promise<PlatformTokens> {
    const response = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ...values,
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
        }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const parsed = tokenResponseSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    if (!response.ok || !parsed.success)
      throw new PublishProviderError({
        category: refreshing ? "authorization_expired" : "provider_error",
        safeMessage: refreshing
          ? "Reconnect LinkedIn to renew authorization."
          : "LinkedIn refused the authorization. Check the app's approved permissions.",
        retriable: !refreshing && response.status >= 500,
        mayHavePublished: false,
      });
    const scopes = parsed.data.scope?.split(/[\s,]+/).filter(Boolean) ?? [
      ...this.credentials.scopes,
    ];
    if (
      this.credentials.requiredScopes?.some((scope) => !scopes.includes(scope))
    )
      throw new PublishProviderError({
        category: "insufficient_permissions",
        safeMessage:
          "LinkedIn did not grant all requested permissions. Reconnect with the approved app.",
        retriable: false,
        mayHavePublished: false,
      });
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token ?? values.refresh_token ?? null,
      expiresAt: parsed.data.expires_in
        ? new Date(Date.now() + parsed.data.expires_in * 1000)
        : null,
      scopes,
    };
  }

  exchangeTokens(input: {
    code: string;
    redirectUri: string;
  }): Promise<PlatformTokens> {
    return this.requestTokens(
      {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
      },
      false,
    );
  }

  refreshTokens(input: { refreshToken: string }): Promise<PlatformTokens> {
    return this.requestTokens(
      { grant_type: "refresh_token", refresh_token: input.refreshToken },
      true,
    );
  }
}
