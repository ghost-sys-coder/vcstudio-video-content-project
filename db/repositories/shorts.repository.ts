import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { shortClips, shortCompositions } from "@/db/schema";

export async function listShortCompositions(input: {
  workspaceId: string;
  projectId: string;
}) {
  return getDatabase()
    .select()
    .from(shortCompositions)
    .where(
      and(
        eq(shortCompositions.workspaceId, input.workspaceId),
        eq(shortCompositions.projectId, input.projectId),
      ),
    )
    .orderBy(desc(shortCompositions.updatedAt), desc(shortCompositions.id))
    .limit(100);
}

export async function listProjectShortClips(input: {
  workspaceId: string;
  projectId: string;
}) {
  return getDatabase()
    .select()
    .from(shortClips)
    .where(
      and(
        eq(shortClips.workspaceId, input.workspaceId),
        eq(shortClips.projectId, input.projectId),
      ),
    )
    .orderBy(asc(shortClips.shortCompositionId), asc(shortClips.position))
    .limit(5000);
}

export async function findShortCompositionWithClips(input: {
  workspaceId: string;
  projectId: string;
  shortCompositionId: string;
}) {
  const [composition] = await getDatabase()
    .select()
    .from(shortCompositions)
    .where(
      and(
        eq(shortCompositions.workspaceId, input.workspaceId),
        eq(shortCompositions.projectId, input.projectId),
        eq(shortCompositions.id, input.shortCompositionId),
      ),
    )
    .limit(1);
  if (!composition) return null;
  const clips = await getDatabase()
    .select()
    .from(shortClips)
    .where(
      and(
        eq(shortClips.workspaceId, input.workspaceId),
        eq(shortClips.projectId, input.projectId),
        eq(shortClips.shortCompositionId, input.shortCompositionId),
      ),
    )
    .orderBy(asc(shortClips.position));
  return { composition, clips };
}
