import type { ContentPlatform } from "@/db/schema";

/**
 * The account-connection half of a platform integration: consent, token
 * exchange, refresh, revoke.
 *
 * Extracted from `VideoPublishProvider` because social posting needs exactly
 * this and a *different* publish half. Every existing video provider already
 * satisfies it, so the split is type-only — the OAuth routes now depend on this
 * narrower contract instead of on a video-publishing interface they never used
 * the publishing part of.
 */

export type PlatformTokens = {
  accessToken: string;
  /** Absent when the platform returns no refresh token on a repeat consent. */
  refreshToken: string | null;
  /** Null when the platform does not expire access tokens. */
  expiresAt: Date | null;
  scopes: string[];
};

export type PlatformAccount = {
  externalAccountId: string;
  externalAccountName: string;
  externalAccountUrl: string | null;
};

export type AuthorizationRequest = {
  /** Opaque signed value echoed back to the callback; providers must not interpret it. */
  state: string;
  redirectUri: string;
};

export interface PlatformOAuthProvider {
  readonly platform: ContentPlatform;
  /** Human label for the account kind, e.g. "YouTube channel". */
  readonly accountLabel: string;
  createAuthorizationUrl(request: AuthorizationRequest): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    /**
     * The same signed `state` that started the flow, for providers that require
     * PKCE. X is the only one today: PKCE binds the authorization code to the
     * client that requested it, which means the code verifier has to survive a
     * redirect through the browser. Rather than storing it, the X provider
     * derives it from this value — see `TwitterOAuthProvider`. Optional because
     * the other four platforms neither need nor read it.
     */
    state?: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }>;
  refreshTokens(input: { refreshToken: string }): Promise<PlatformTokens>;
  revokeAuthorization?(input: { accessToken: string }): Promise<void>;
}
