import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets, projectRenderEffects } from "@/db/schema";

/**
 * A project's presentation effects, with the sound bed's stored object key
 * resolved alongside so a render can sign it without a second query.
 *
 * Returns null when a project has never been given any, which is the normal
 * state: the row is created on first save rather than with the project, so
 * nothing exists for a project that uses none.
 */
export async function findProjectRenderEffects(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [row] = await getDatabase()
    .select({
      effects: projectRenderEffects,
      backgroundObjectKey: mediaAssets.objectKey,
      backgroundTitle: mediaAssets.title,
      backgroundFileName: mediaAssets.originalFileName,
      backgroundDeletedAt: mediaAssets.deletedAt,
      backgroundStatus: mediaAssets.status,
    })
    .from(projectRenderEffects)
    // Left join: the bed is optional, and a project with the meter alone must
    // still come back.
    .leftJoin(
      mediaAssets,
      and(
        eq(mediaAssets.id, projectRenderEffects.backgroundMediaAssetId),
        eq(mediaAssets.workspaceId, projectRenderEffects.workspaceId),
      ),
    )
    .where(
      and(
        eq(projectRenderEffects.workspaceId, input.workspaceId),
        eq(projectRenderEffects.projectId, input.projectId),
      ),
    )
    .limit(1);
  return row ?? null;
}
