import type {
  ContentPlatform,
  SocialPost,
  SocialPostStatus,
  SocialPostTarget,
  SocialPostTargetStatus,
} from "@/db/schema";
import type { MediaAssetView } from "@/lib/media/media-asset-view";
import type { PortableDocument } from "@/lib/social/portable-document";
import type { SocialPostAttachment } from "@/lib/social/post-attachment";

/**
 * Client-safe projections for the social screens.
 *
 * Kept free of `server-only` so the composer, the posts list, and the server
 * loader all share one vocabulary — the same arrangement the character animation
 * check uses.
 */

export type SocialPostTargetView = {
  id: string;
  platform: ContentPlatform;
  platformLabel: string;
  connectionId: string;
  accountName: string;
  status: SocialPostTargetStatus;
  externalPostUrl: string | null;
  safeErrorMessage: string | null;
  publishedAt: string | null;
};

export type SocialPostSummaryView = {
  id: string;
  name: string;
  status: SocialPostStatus;
  excerpt: string;
  scheduledAt: string | null;
  scheduledTimezone: string;
  createdAt: string;
  targets: SocialPostTargetView[];
  mediaCount: number;
};

export type SocialPostComposerView = {
  id: string;
  name: string;
  status: SocialPostStatus;
  version: number;
  bodyDocument: PortableDocument;
  bodyPlainText: string;
  scheduledAt: string | null;
  scheduledTimezone: string;
  attachments: PostAttachmentView[];
  targets: SocialPostTargetView[];
  /** Connected accounts this workspace could send to, whatever is attached. */
  availableConnections: PostConnectionView[];
  editable: boolean;
};

export type PostConnectionView = {
  id: string;
  platform: ContentPlatform;
  platformLabel: string;
  accountName: string;
  status: "active" | "expired" | "revoked";
};

export type PostAttachmentView = {
  asset: MediaAssetView;
  /** Where the file came from, so the composer can label a render as one. */
  source: "library" | "render";
  /**
   * True when the file can no longer be sent — a library asset removed after
   * the fact, or a render whose output is gone. The post keeps the attachment,
   * because a published post must show what it sent, but the composer says so
   * rather than presenting it as a normal, reusable attachment.
   */
  unavailable: boolean;
};

/**
 * Projects an attachment for the browser. The signed URL is passed in rather
 * than derived here so this stays free of storage and `server-only`.
 */
export function toPostAttachmentView(
  attachment: SocialPostAttachment,
  previewUrl: string,
): PostAttachmentView {
  return {
    asset: {
      id: attachment.sourceId,
      kind: attachment.kind,
      title: attachment.title,
      altText: attachment.altText,
      tags: [],
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      width: attachment.width,
      height: attachment.height,
      durationMilliseconds: attachment.durationMilliseconds,
      originalFileName: attachment.originalFileName,
      createdAt: attachment.createdAt.toISOString(),
      previewUrl,
    },
    source: attachment.source,
    unavailable: attachment.unavailable,
  };
}

const EXCERPT_LENGTH = 140;

export function buildPostExcerpt(plainText: string): string {
  const collapsed = plainText.replace(/\s+/g, " ").trim();
  return collapsed.length <= EXCERPT_LENGTH
    ? collapsed
    : `${collapsed.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`;
}

export function toSocialPostTargetView(input: {
  target: SocialPostTarget;
  platformLabel: string;
  accountName: string;
}): SocialPostTargetView {
  return {
    id: input.target.id,
    platform: input.target.platform,
    platformLabel: input.platformLabel,
    connectionId: input.target.connectionId,
    accountName: input.accountName,
    status: input.target.status,
    externalPostUrl: input.target.externalPostUrl,
    safeErrorMessage: input.target.safeErrorMessage,
    publishedAt: input.target.publishedAt?.toISOString() ?? null,
  };
}

export function toSocialPostSummaryView(input: {
  post: SocialPost;
  targets: SocialPostTargetView[];
  mediaCount: number;
}): SocialPostSummaryView {
  return {
    id: input.post.id,
    name: input.post.name,
    status: input.post.status,
    excerpt: buildPostExcerpt(input.post.bodyPlainText),
    scheduledAt: input.post.scheduledAt?.toISOString() ?? null,
    scheduledTimezone: input.post.scheduledTimezone,
    createdAt: input.post.createdAt.toISOString(),
    targets: input.targets,
    mediaCount: input.mediaCount,
  };
}
