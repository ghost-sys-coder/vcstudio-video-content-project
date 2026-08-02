import type { PublicationVisibility } from "@/db/schema";
import type { PlatformOAuthProvider } from "@/lib/publishing/platform-oauth-provider";

/**
 * Narrow contract every rendered-video destination implements. YouTube ships
 * first; Facebook, Instagram, and TikTok are added by writing another
 * implementation and registering it — no changes to the schema, commands, task,
 * or UI.
 *
 * The OAuth half now lives in {@link PlatformOAuthProvider}, which this extends,
 * so the social post pipeline can reuse account connection without depending on
 * video publishing. Anything a single platform needs beyond this belongs inside
 * its own implementation, not widened into the shared interface.
 */

export type {
  AuthorizationRequest,
  PlatformAccount,
  PlatformTokens,
} from "@/lib/publishing/platform-oauth-provider";

import type {
  PlatformTokens,
  PlatformAccount,
} from "@/lib/publishing/platform-oauth-provider";

export type PublishVideoRequest = {
  tokens: Pick<PlatformTokens, "accessToken">;
  /** Destination account selected by the authorized workspace member. */
  account: Pick<PlatformAccount, "externalAccountId">;
  /** Short-lived signed URL the provider streams from; never a local path. */
  sourceUrl: string;
  sizeBytes: number;
  contentType: string;
  title: string;
  description: string;
  tags: string[];
  visibility: PublicationVisibility;
  caption: string | null;
  shareToFeed: boolean | null;
  /** Existing async operation/container id used to resume a previous attempt. */
  providerOperationId: string | null;
  /** Decrypted, short-lived provider checkpoint credential. Never exposed to UI. */
  providerOperationSecret: string | null;
  onProviderOperationCreated?: (
    operationId: string,
    operationSecret?: string,
  ) => void | Promise<void>;
  onProcessingProgress?: (percent: number) => void | Promise<void>;
  /** Injected by durable workers; tests may omit it for an immediate tick. */
  waitForProcessing?: (milliseconds: number) => Promise<void>;
  /** Reports 0–100 so the UI can show real upload progress. */
  onProgress?: (percent: number) => void | Promise<void>;
};

export type PublishVideoResult = {
  externalVideoId: string;
  externalVideoUrl: string;
  uploadedBytes: number;
  completionStage: "published" | "inbox_delivered";
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
  /** The request provably never reached the provider (DNS, refused, connect timeout). */
  | "network_unreachable"
  /** The configured provider API version is retired and must be updated. */
  | "provider_version_retired"
  /**
   * The provider does not serve the endpoint this integration called. Like
   * `provider_version_retired`, this is a fault in our configuration or code
   * rather than in the account, so reconnecting or retrying cannot fix it.
   */
  | "provider_endpoint_missing"
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

export interface VideoPublishProvider extends PlatformOAuthProvider {
  publishVideo(request: PublishVideoRequest): Promise<PublishVideoResult>;
}
