import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { platformConnections, socialPostDraftDestinations } from "@/db/schema";
import { MAX_SOCIAL_POST_DESTINATIONS } from "@studio/contracts";

export async function listSocialPostDraftConnectionIds(input: {
  workspaceId: string;
  postId: string;
}) {
  const rows = await getDatabase()
    .select({ id: socialPostDraftDestinations.connectionId })
    .from(socialPostDraftDestinations)
    .where(
      and(
        eq(socialPostDraftDestinations.workspaceId, input.workspaceId),
        eq(socialPostDraftDestinations.postId, input.postId),
      ),
    )
    .orderBy(socialPostDraftDestinations.connectionId)
    .limit(MAX_SOCIAL_POST_DESTINATIONS);
  return rows.map((row) => row.id);
}

export async function findSocialPostDestinationConnections(input: {
  workspaceId: string;
  connectionIds: string[];
}) {
  if (!input.connectionIds.length) return [];
  return getDatabase()
    .select({
      id: platformConnections.id,
      platform: platformConnections.platform,
    })
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, input.workspaceId),
        inArray(platformConnections.id, input.connectionIds),
      ),
    )
    .limit(MAX_SOCIAL_POST_DESTINATIONS);
}
