import type { ContentPlatform, MediaAssetKind } from "@/db/schema";
import type { PlatformTokens } from "@/lib/publishing/platform-oauth-provider";
import type { PublishFailure } from "@/lib/publishing/video-publish-provider";

/**
 * Narrow contract for sending a **social post** — body text plus optional
 * library media — to one connected account.
 *
 * Deliberately separate from `VideoPublishProvider` rather than a widening of
 * it. That interface is shaped around a rendered project export (a title, a
 * description, tags, a visibility, one video); a post is shaped around a body
 * and an ordered media list, and three of the five destinations accept media
 * combinations a render never produces. The OAuth half both need is shared
 * through `PlatformOAuthProvider`.
 *
 * The failure taxonomy is reused verbatim from the video path, so both pipelines
 * classify and report problems identically.
 */

export type SocialPostMediaItem = {
  kind: MediaAssetKind;
  /** Short-lived signed R2 URL the provider streams from; never a local path. */
  sourceUrl: string;
  contentType: string;
  sizeBytes: number;
  altText: string;
  fileName: string;
};

export type PublishPostRequest = {
  tokens: Pick<PlatformTokens, "accessToken">;
  /** Destination account selected by the authorized workspace member. */
  account: { externalAccountId: string };
  /** The already-flattened plain text. Providers must not re-render markup. */
  text: string;
  /** In send order — carousel sequence on Instagram, image order elsewhere. */
  media: SocialPostMediaItem[];
  /** Existing async operation/container id used to resume a previous attempt. */
  providerOperationId: string | null;
  /** Decrypted, short-lived provider checkpoint credential. Never exposed to UI. */
  providerOperationSecret: string | null;
  onProviderOperationCreated?: (
    operationId: string,
    operationSecret?: string,
  ) => void | Promise<void>;
  /** Injected by durable workers; tests may omit it for an immediate tick. */
  waitForProcessing?: (milliseconds: number) => Promise<void>;
  /** Reports 0–100 so the UI can show real progress. */
  onProgress?: (percent: number) => void | Promise<void>;
};

export type PublishPostResult = {
  externalPostId: string;
  externalPostUrl: string;
  /**
   * `inbox_delivered` covers TikTok, where the upload lands in the creator's
   * inbox and a human finishes the post — reported honestly rather than as a
   * publication that already exists.
   */
  completionStage: "published" | "inbox_delivered";
};

export interface SocialPostProvider {
  readonly platform: ContentPlatform;
  publishPost(request: PublishPostRequest): Promise<PublishPostResult>;
}

export type { PublishFailure };
