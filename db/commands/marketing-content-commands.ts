import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingContentItems,
  marketingContentMedia,
  marketingContentRevisions,
  type ContentPlatform,
  type MarketingContentKind,
  type MarketingContentStatus,
} from "@/db/schema";
import { findMarketingContentItem } from "@/db/repositories/marketing-content.repository";
import { assertMarketingContentTransition } from "@/lib/marketing/content/content-status";
import type { PortableDocument } from "@/lib/social/portable-document";

export async function createMarketingContentItem(input: {
  workspaceId: string;
  kind: MarketingContentKind;
  platform?: ContentPlatform | null;
  title: string;
  bodyDocument: PortableDocument;
  bodyPlainText: string;
  sourceRunId?: string | null;
  createdByUserId?: string | null;
}) {
  const database = getDatabase();
  const [item] = await database
    .insert(marketingContentItems)
    .values({
      ...input,
      platform: input.platform ?? null,
      sourceRunId: input.sourceRunId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      status: "needs_review",
    })
    .returning();
  if (!item) throw new Error("MARKETING_CONTENT_NOT_CREATED");
  await database.insert(marketingContentRevisions).values({
    workspaceId: input.workspaceId,
    contentItemId: item.id,
    revisionNumber: 1,
    bodyDocument: input.bodyDocument,
    bodyPlainText: input.bodyPlainText,
    changeSource: "ai",
    runId: input.sourceRunId ?? null,
  });
  return item;
}

export async function attachMediaToMarketingContent(input: {
  workspaceId: string;
  contentItemId: string;
  mediaAssetId: string;
}): Promise<void> {
  await getDatabase().insert(marketingContentMedia).values({
    workspaceId: input.workspaceId,
    contentItemId: input.contentItemId,
    mediaAssetId: input.mediaAssetId,
    position: 0,
  });
}

export async function transitionMarketingContent(input: {
  workspaceId: string;
  contentItemId: string;
  to: MarketingContentStatus;
  reviewedByUserId: string;
  reviewNotes?: string;
}) {
  const current = await findMarketingContentItem(input);
  if (!current) throw new Error("MARKETING_CONTENT_NOT_FOUND");
  assertMarketingContentTransition(current.status, input.to);
  const [updated] = await getDatabase()
    .update(marketingContentItems)
    .set({
      status: input.to,
      reviewedByUserId: input.reviewedByUserId,
      reviewNotes: input.reviewNotes ?? "",
      approvedAt: input.to === "approved" ? new Date() : current.approvedAt,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingContentItems.id, input.contentItemId),
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.status, current.status),
      ),
    )
    .returning();
  if (!updated) throw new Error("MARKETING_CONTENT_CONFLICT");
  return updated;
}

export async function updateMarketingContentBody(input: {
  workspaceId: string;
  contentItemId: string;
  title: string;
  bodyDocument: PortableDocument;
  bodyPlainText: string;
  changedByUserId: string;
}) {
  const current = await findMarketingContentItem(input);
  if (
    !current ||
    !["draft", "needs_review", "changes_requested"].includes(current.status)
  )
    throw new Error("MARKETING_CONTENT_NOT_EDITABLE");
  const database = getDatabase();
  const [updated] = await database
    .update(marketingContentItems)
    .set({
      title: input.title,
      bodyDocument: input.bodyDocument,
      bodyPlainText: input.bodyPlainText,
      status: "needs_review",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingContentItems.id, input.contentItemId),
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.status, current.status),
      ),
    )
    .returning();
  if (!updated) throw new Error("MARKETING_CONTENT_CONFLICT");
  await database.insert(marketingContentRevisions).values({
    workspaceId: input.workspaceId,
    contentItemId: input.contentItemId,
    revisionNumber: sql`(select coalesce(max(revision_number), 0) + 1 from marketing_content_revisions where content_item_id = ${input.contentItemId})`,
    bodyDocument: input.bodyDocument,
    bodyPlainText: input.bodyPlainText,
    changeSource: "human",
    changedByUserId: input.changedByUserId,
  });
  return updated;
}

export async function attachSocialPostToMarketingContent(input: {
  workspaceId: string;
  contentItemId: string;
  socialPostId: string;
}) {
  const [updated] = await getDatabase()
    .update(marketingContentItems)
    .set({ socialPostId: input.socialPostId, updatedAt: new Date() })
    .where(
      and(
        eq(marketingContentItems.id, input.contentItemId),
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.status, "approved"),
        sql`${marketingContentItems.socialPostId} is null`,
      ),
    )
    .returning();
  if (!updated) throw new Error("MARKETING_CONTENT_HANDOFF_CONFLICT");
  return updated;
}
