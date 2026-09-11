import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets, projectRenderEffects } from "@/db/schema";

export class RenderEffectsConflictError extends Error {
  constructor() {
    super("Somebody else changed these settings while you were working.");
    this.name = "RenderEffectsConflictError";
  }
}

export class RenderEffectsMediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderEffectsMediaError";
  }
}

export type RenderEffectsInput = {
  workspaceId: string;
  projectId: string;
  userId: string;
  backgroundMediaAssetId: string | null;
  backgroundVolumePercent: number;
  backgroundLoop: boolean;
  levelMeterEnabled: boolean;
  levelMeterPosition: string;
  /** Null creates the row; a number must match the row being replaced. */
  expectedRevision: number | null;
};

/**
 * Saves a project's presentation effects as a whole row.
 *
 * Whole-row with an optimistic lock rather than field-by-field, because the one
 * form writes every field: a partial update would let two people each save a
 * stale copy of the other's field and quietly lose one of them.
 */
export async function saveProjectRenderEffects(input: RenderEffectsInput) {
  const database = getDatabase();

  if (input.backgroundMediaAssetId) {
    // Verified here as well as by the composite foreign key. The key stops a
    // cross-workspace asset; this also stops a deleted one and anything that
    // is not actually audio, and gives a usable message instead of a
    // constraint violation.
    const [asset] = await database
      .select({ kind: mediaAssets.kind, status: mediaAssets.status })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.workspaceId, input.workspaceId),
          eq(mediaAssets.id, input.backgroundMediaAssetId),
          isNull(mediaAssets.deletedAt),
        ),
      )
      .limit(1);
    if (!asset)
      throw new RenderEffectsMediaError("That sound file is unavailable.");
    if (asset.kind !== "audio")
      throw new RenderEffectsMediaError(
        "Background sound must be an audio file.",
      );
    if (asset.status !== "ready")
      throw new RenderEffectsMediaError(
        "That sound file has not finished uploading.",
      );
  }

  const values = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    backgroundMediaAssetId: input.backgroundMediaAssetId,
    backgroundVolumePercent: input.backgroundVolumePercent,
    backgroundLoop: input.backgroundLoop,
    levelMeterEnabled: input.levelMeterEnabled,
    levelMeterPosition: input.levelMeterPosition,
    updatedByUserId: input.userId,
    updatedAt: new Date(),
  };

  if (input.expectedRevision === null) {
    const [created] = await database
      .insert(projectRenderEffects)
      .values({ ...values, revision: 1 })
      // A row already existing means somebody created it first, which is the
      // same situation as a stale revision and is reported the same way.
      .onConflictDoNothing({ target: projectRenderEffects.projectId })
      .returning();
    if (!created) throw new RenderEffectsConflictError();
    return created;
  }

  const [updated] = await database
    .update(projectRenderEffects)
    .set({ ...values, revision: input.expectedRevision + 1 })
    .where(
      and(
        eq(projectRenderEffects.workspaceId, input.workspaceId),
        eq(projectRenderEffects.projectId, input.projectId),
        eq(projectRenderEffects.revision, input.expectedRevision),
      ),
    )
    .returning();
  if (!updated) throw new RenderEffectsConflictError();
  return updated;
}
