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
  campaignId?: string | null;
  kind: MarketingContentKind;
  platform?: ContentPlatform | null;
  title: string;
  bodyDocument: PortableDocument;
  bodyPlainText: string;
  sourceRunId?: string | null;
  createdByUserId?: string | null;
  trafficType?: "organic" | "paid" | "both";
  isBranded?: boolean;
  structuredPayload?: Record<string, unknown> | null;
  scheduledFor?: Date | null;
}) {
  const database = getDatabase();
  const [item] = await database
    .insert(marketingContentItems)
    .values({
      ...input,
      campaignId: input.campaignId ?? null,
      platform: input.platform ?? null,
      sourceRunId: input.sourceRunId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      trafficType: input.trafficType ?? "organic",
      isBranded: input.isBranded ?? true,
      structuredPayload: input.structuredPayload ?? null,
      scheduledFor: input.scheduledFor ?? null,
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

export async function updateMarketingContentStructuredPayload(input: {
  workspaceId: string;
  contentItemId: string;
  structuredPayload: Record<string, unknown>;
}) {
  await getDatabase()
    .update(marketingContentItems)
    .set({ structuredPayload: input.structuredPayload, updatedAt: new Date() })
    .where(
      and(
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.id, input.contentItemId),
      ),
    );
}

export async function failMarketingContentItem(input: {
  workspaceId: string;
  contentItemId: string;
  category: string;
  message: string;
}) {
  await getDatabase()
    .update(marketingContentItems)
    .set({
      status: "failed",
      errorCategory: input.category,
      safeErrorMessage: input.message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.id, input.contentItemId),
        eq(marketingContentItems.status, "needs_review"),
      ),
    );
}

export async function recordMarketingContentAutomationWarning(input: {
  workspaceId: string;
  contentItemId: string;
  category: string;
  message: string;
}) {
  await getDatabase()
    .update(marketingContentItems)
    .set({
      errorCategory: input.category,
      safeErrorMessage: input.message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.id, input.contentItemId),
        eq(marketingContentItems.status, "approved"),
      ),
    );
}

export async function transitionMarketingContent(input: {
  workspaceId: string;
  contentItemId: string;
  to: MarketingContentStatus;
  reviewedByUserId: string;
  reviewNotes?: string;
}) {
  if (
    input.to !== "approved" &&
    input.to !== "changes_requested" &&
    input.to !== "archived"
  )
    throw new Error("MARKETING_CONTENT_REVIEW_DECISION_REQUIRED");
  const current = await findMarketingContentItem(input);
  if (!current) throw new Error("MARKETING_CONTENT_NOT_FOUND");
  assertMarketingContentTransition(current.status, input.to);
  const now = new Date();
  const result = await getDatabase().execute(sql`
    with updated as (
      update marketing_content_items
      set status = ${input.to}::marketing_content_status,
          reviewed_by_user_id = ${input.reviewedByUserId}::uuid,
          review_notes = ${input.reviewNotes ?? ""},
          approved_at = ${input.to === "approved" ? now : current.approvedAt},
          updated_at = ${now}
      where id = ${input.contentItemId}::uuid
        and workspace_id = ${input.workspaceId}::uuid
        and status = ${current.status}::marketing_content_status
      returning id, workspace_id
    )
    insert into marketing_content_review_events (
      id, workspace_id, content_item_id, decision, reason,
      reviewed_by_user_id, created_at
    )
    select gen_random_uuid(), workspace_id, id,
      ${input.to}::marketing_content_review_decision,
      ${input.reviewNotes ?? ""}, ${input.reviewedByUserId}::uuid, ${now}
    from updated
    returning content_item_id
  `);
  if (!result.rows[0]) throw new Error("MARKETING_CONTENT_CONFLICT");
  const updated = await findMarketingContentItem(input);
  if (!updated) throw new Error("MARKETING_CONTENT_NOT_FOUND");
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
