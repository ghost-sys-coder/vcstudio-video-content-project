import "server-only";
import { and, eq, desc, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneVisualSelections } from "@/db/schema";
export async function findSceneVisualSelection(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(sceneVisualSelections)
    .where(
      and(
        eq(sceneVisualSelections.workspaceId, input.workspaceId),
        eq(sceneVisualSelections.projectId, input.projectId),
        eq(sceneVisualSelections.sceneVersionId, input.sceneVersionId),
      ),
    )
    .orderBy(desc(sceneVisualSelections.revision))
    .limit(1);
  return row ?? null;
}
export async function listSceneVisualSelections(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
}) {
  if (!input.sceneVersionIds.length) return [];
  return getDatabase()
    .selectDistinctOn([sceneVisualSelections.sceneVersionId])
    .from(sceneVisualSelections)
    .where(
      and(
        eq(sceneVisualSelections.workspaceId, input.workspaceId),
        eq(sceneVisualSelections.projectId, input.projectId),
        inArray(
          sceneVisualSelections.sceneVersionId,
          input.sceneVersionIds.slice(0, 1000),
        ),
      ),
    )
    .orderBy(
      sceneVisualSelections.sceneVersionId,
      desc(sceneVisualSelections.revision),
    );
}
