import type { ContentPlatform, PublicationVisibility } from "@/db/schema";

/**
 * Narrow contract every publishing destination implements. YouTube ships first;
 * Facebook, Instagram, and TikTok are added by writing another implementation
 * and registering it — no changes to the schema, commands, task, or UI.
 *
 * Kept intentionally small (authorize → exchange → refresh → upload). Anything
 * a single platform needs beyond this belongs inside its own implementation,
 * not widened into the shared interface.
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

export type PublishVideoRequest = {
  tokens: Pick<PlatformTokens, "accessToken">;
  /** Short-lived signed URL the provider streams from; never a local path. */
  sourceUrl: string;
  sizeBytes: number;
  contentType: string;
  title: string;
  description: string;
  tags: string[];
  visibility: PublicationVisibility;
  /** Reports 0–100 so the UI can show real upload progress. */
  onProgress?: (percent: number) => void | Promise<void>;
};

export type PublishVideoResult = {
  externalVideoId: string;
  externalVideoUrl: string;
  uploadedBytes: number;
};

/** Stable, platform-independent failure taxonomy the task maps to user copy. */
export type PublishFailureCategory =
  | "authorization_expired"
  | "insufficient_permissions"
  | "quota_exceeded"
  | "rate_limited"
  | "invalid_metadata"
  | "video_rejected"
  | "asset_unavailable"
  | "provider_server_error"
  | "transport_ambiguous"
  | "provider_error";

export type PublishFailure = {
  category: PublishFailureCategory;
  safeMessage: string;
  retriable: boolean;
  /** True when the upload may already have created a video despite the error. */
  mayHavePublished: boolean;
};

export class PublishProviderError extends Error {
  readonly failure: PublishFailure;

  constructor(failure: PublishFailure) {
    super(failure.safeMessage);
    this.name = "PublishProviderError";
    this.failure = failure;
  }
}

export interface VideoPublishProvider {
  readonly platform: ContentPlatform;
  /** Human label for the account kind, e.g. "YouTube channel". */
  readonly accountLabel: string;
  createAuthorizationUrl(request: AuthorizationRequest): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
  }): Promise<{ tokens: PlatformTokens; account: PlatformAccount }>;
  refreshTokens(input: { refreshToken: string }): Promise<PlatformTokens>;
  publishVideo(request: PublishVideoRequest): Promise<PublishVideoResult>;
}
