import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { contentIdeas, type ContentIdea } from "@/db/schema";

/**
 * List a workspace's saved ideas, newest first. Grouping by niche happens in the
 * view layer; the `(workspaceId, niche)` and `(workspaceId, createdAt)` indexes
 * cover both the grouping and this ordering. Workspace scoped so a browser can
 * never read another tenant's ideas.
 */
export async function listContentIdeas(input: {
  workspaceId: string;
  includeArchived?: boolean;
}): Promise<ContentIdea[]> {
  const conditions = [eq(contentIdeas.workspaceId, input.workspaceId)];
  if (!input.includeArchived)
    conditions.push(eq(contentIdeas.isArchived, false));
  return getDatabase()
    .select()
    .from(contentIdeas)
    .where(and(...conditions))
    .orderBy(desc(contentIdeas.createdAt));
}

/**
 * Fetch one idea scoped to the authorized workspace. Used by the script-screen
 * autofill; returning null for a foreign id is the cross-workspace guard.
 */
export async function findContentIdea(input: {
  workspaceId: string;
  ideaId: string;
}): Promise<ContentIdea | null> {
  const [idea] = await getDatabase()
    .select()
    .from(contentIdeas)
    .where(
      and(
        eq(contentIdeas.id, input.ideaId),
        eq(contentIdeas.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return idea ?? null;
}
