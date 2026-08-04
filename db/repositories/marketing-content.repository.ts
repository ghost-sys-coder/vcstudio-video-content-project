import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingContentItems,
  marketingContentMedia,
  marketingContentRevisions,
  socialPosts,
  type MarketingContentItem,
  type MarketingContentStatus,
} from "@/db/schema";

export type MarketingCalendarItem = {
  item: MarketingContentItem;
  socialStatus: typeof socialPosts.$inferSelect.status | null;
  socialScheduledAt: Date | null;
};

export async function listMarketingContentItems(input: {
  workspaceId: string;
  statuses?: MarketingContentStatus[];
  limit?: number;
}): Promise<MarketingContentItem[]> {
  const conditions = [eq(marketingContentItems.workspaceId, input.workspaceId)];
  if (input.statuses?.length)
    conditions.push(inArray(marketingContentItems.status, input.statuses));
  return getDatabase()
    .select()
    .from(marketingContentItems)
    .where(and(...conditions))
    .orderBy(desc(marketingContentItems.createdAt))
    .limit(input.limit ?? 100);
}

export async function listMarketingCalendarItems(input: {
  workspaceId: string;
  limit?: number;
}): Promise<MarketingCalendarItem[]> {
  return getDatabase()
    .select({
      item: marketingContentItems,
      socialStatus: socialPosts.status,
      socialScheduledAt: socialPosts.scheduledAt,
    })
    .from(marketingContentItems)
    .leftJoin(
      socialPosts,
      and(
        eq(socialPosts.id, marketingContentItems.socialPostId),
        eq(socialPosts.workspaceId, marketingContentItems.workspaceId),
      ),
    )
    .where(eq(marketingContentItems.workspaceId, input.workspaceId))
    .orderBy(desc(marketingContentItems.createdAt))
    .limit(input.limit ?? 100);
}
export async function findMarketingContentItem(input: {
  workspaceId: string;
  contentItemId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(marketingContentItems)
    .where(
      and(
        eq(marketingContentItems.workspaceId, input.workspaceId),
        eq(marketingContentItems.id, input.contentItemId),
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function listMarketingContentMedia(input: {
  workspaceId: string;
  contentItemId: string;
}) {
  return getDatabase()
    .select()
    .from(marketingContentMedia)
    .where(
      and(
        eq(marketingContentMedia.workspaceId, input.workspaceId),
        eq(marketingContentMedia.contentItemId, input.contentItemId),
      ),
    )
    .orderBy(asc(marketingContentMedia.position));
}
export async function listMarketingContentRevisions(input: {
  workspaceId: string;
  contentItemId: string;
}) {
  return getDatabase()
    .select()
    .from(marketingContentRevisions)
    .where(
      and(
        eq(marketingContentRevisions.workspaceId, input.workspaceId),
        eq(marketingContentRevisions.contentItemId, input.contentItemId),
      ),
    )
    .orderBy(desc(marketingContentRevisions.revisionNumber));
}
