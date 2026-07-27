import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneAnimationDirections } from "@/db/schema";

// Phase 0 has no picker UI for this yet — a scene version is wired to an
// animated character directly through this command (e.g. for the pilot),
// with a per-line pose-direction UI as real Phase 1 product surface.
export async function setSceneAnimationDirection(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  characterId: string;
  createdByUserId: string;
}) {
  const [direction] = await getDatabase()
    .insert(sceneAnimationDirections)
    .values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sceneVersionId: input.sceneVersionId,
      characterId: input.characterId,
      createdByUserId: input.createdByUserId,
    })
    .onConflictDoUpdate({
      target: sceneAnimationDirections.sceneVersionId,
      set: {
        characterId: input.characterId,
        createdByUserId: input.createdByUserId,
      },
    })
    .returning();
  if (!direction) throw new Error("SCENE_ANIMATION_DIRECTION_SET_FAILED");
  return direction;
}

export async function clearSceneAnimationDirection(input: {
  workspaceId: string;
  sceneVersionId: string;
}): Promise<void> {
  await getDatabase()
    .delete(sceneAnimationDirections)
    .where(eq(sceneAnimationDirections.sceneVersionId, input.sceneVersionId));
}
