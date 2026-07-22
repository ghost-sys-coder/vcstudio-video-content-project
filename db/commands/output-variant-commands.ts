import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneVariantFramings, type SceneFramingMode } from "@/db/schema";

export async function saveSceneVariantFraming(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
  sceneId: string;
  sceneVersionId: string;
  sourceImageGenerationId: string;
  mode: SceneFramingMode;
  focalPointXBps: number;
  focalPointYBps: number;
  scaleBps: number;
  backgroundColor: string;
  updatedByUserId: string;
}) {
  const [saved] = await getDatabase()
    .insert(sceneVariantFramings)
    .values(input)
    .onConflictDoUpdate({
      target: [
        sceneVariantFramings.outputVariantId,
        sceneVariantFramings.sceneVersionId,
      ],
      set: {
        sourceImageGenerationId: input.sourceImageGenerationId,
        mode: input.mode,
        focalPointXBps: input.focalPointXBps,
        focalPointYBps: input.focalPointYBps,
        scaleBps: input.scaleBps,
        backgroundColor: input.backgroundColor,
        updatedByUserId: input.updatedByUserId,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!saved) throw new Error("SCENE_VARIANT_FRAMING_NOT_SAVED");
  return saved;
}

export async function deleteSceneVariantFraming(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
  sceneVersionId: string;
}) {
  const deleted = await getDatabase()
    .delete(sceneVariantFramings)
    .where(
      and(
        eq(sceneVariantFramings.workspaceId, input.workspaceId),
        eq(sceneVariantFramings.projectId, input.projectId),
        eq(sceneVariantFramings.outputVariantId, input.outputVariantId),
        eq(sceneVariantFramings.sceneVersionId, input.sceneVersionId),
      ),
    )
    .returning({ id: sceneVariantFramings.id });
  return deleted.length > 0;
}
