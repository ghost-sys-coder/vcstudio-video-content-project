import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneCaptionCues, type SceneCaptionCues } from "@/db/schema";

/**
 * Hand-set caption times for the scenes of one project.
 *
 * Read in one query for the whole project, because the subtitle workspace and
 * every export build the entire track at once; asking per scene would grow the
 * query count with the video's length.
 *
 * Corrections are looked up by **both** scene version and audio generation. A
 * row whose audio generation is no longer the approved one is simply not
 * returned, which is how replacing narration invalidates its own corrections
 * without deleting anything or running a cleanup.
 */
export async function listSceneCaptionCues(input: {
  workspaceId: string;
  projectId: string;
  audioGenerationIds: readonly string[];
}): Promise<SceneCaptionCues[]> {
  if (input.audioGenerationIds.length === 0) return [];
  return getDatabase()
    .select()
    .from(sceneCaptionCues)
    .where(
      and(
        eq(sceneCaptionCues.workspaceId, input.workspaceId),
        eq(sceneCaptionCues.projectId, input.projectId),
        inArray(sceneCaptionCues.audioGenerationId, [
          ...input.audioGenerationIds,
        ]),
      ),
    );
}

/** One scene's corrections for one exact narration, or `null` when none exist. */
export async function findSceneCaptionCues(input: {
  workspaceId: string;
  sceneVersionId: string;
  audioGenerationId: string;
}): Promise<SceneCaptionCues | null> {
  const rows = await getDatabase()
    .select()
    .from(sceneCaptionCues)
    .where(
      and(
        eq(sceneCaptionCues.workspaceId, input.workspaceId),
        eq(sceneCaptionCues.sceneVersionId, input.sceneVersionId),
        eq(sceneCaptionCues.audioGenerationId, input.audioGenerationId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
