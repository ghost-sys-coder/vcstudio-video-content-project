import "server-only";

import { and, eq, sql } from "drizzle-orm";
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

/**
 * Applies one shared framing to several scenes at once, as a single
 * multi-row upsert rather than one round trip per scene.
 */
export async function saveSceneVariantFramingBulk(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
  mode: SceneFramingMode;
  focalPointXBps: number;
  focalPointYBps: number;
  scaleBps: number;
  backgroundColor: string;
  updatedByUserId: string;
  targets: {
    sceneId: string;
    sceneVersionId: string;
    sourceImageGenerationId: string;
  }[];
}) {
  return getDatabase()
    .insert(sceneVariantFramings)
    .values(
      input.targets.map((target) => ({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        outputVariantId: input.outputVariantId,
        sceneId: target.sceneId,
        sceneVersionId: target.sceneVersionId,
        sourceImageGenerationId: target.sourceImageGenerationId,
        mode: input.mode,
        focalPointXBps: input.focalPointXBps,
        focalPointYBps: input.focalPointYBps,
        scaleBps: input.scaleBps,
        backgroundColor: input.backgroundColor,
        updatedByUserId: input.updatedByUserId,
      })),
    )
    .onConflictDoUpdate({
      target: [
        sceneVariantFramings.outputVariantId,
        sceneVariantFramings.sceneVersionId,
      ],
      set: {
        sourceImageGenerationId: sql`excluded.source_image_generation_id`,
        mode: sql`excluded.mode`,
        focalPointXBps: sql`excluded.focal_point_x_bps`,
        focalPointYBps: sql`excluded.focal_point_y_bps`,
        scaleBps: sql`excluded.scale_bps`,
        backgroundColor: sql`excluded.background_color`,
        updatedByUserId: sql`excluded.updated_by_user_id`,
        updatedAt: new Date(),
      },
    })
    .returning();
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
