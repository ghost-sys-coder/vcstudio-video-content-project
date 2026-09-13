import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { sceneVideoGenerations, usageReservations } from "@/db/schema";

/**
 * Reads of scene clips.
 *
 * Every query is scoped by workspace as well as by whatever identifies the row,
 * as `AGENTS.md` requires: a clip id arriving from a browser is a claim, not a
 * fact, and scoping by id alone would let one workspace read another's work.
 */

/** How many clips one page may return. Nothing here is ever unbounded. */
const MAX_CLIPS_PER_SCENE = 50;

export async function findSceneClipGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(sceneVideoGenerations)
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.id, input.generationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findSceneClipByRequestNonce(input: {
  workspaceId: string;
  projectId: string;
  requestNonce: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(sceneVideoGenerations)
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.requestNonce, input.requestNonce),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findSceneClipByIdempotencyKey(input: {
  workspaceId: string;
  projectId: string;
  idempotencyKey: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(sceneVideoGenerations)
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * The next generation number for a scene version.
 *
 * Counted from the rows rather than held anywhere, so two requests racing for
 * the same number both compute it and the version unique index settles which
 * one keeps it. The loser is told to try again rather than silently overwriting.
 */
export async function getNextSceneClipGenerationVersion(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
}): Promise<number> {
  const [row] = await getDatabase()
    .select({
      highest: sql<number>`coalesce(max(${sceneVideoGenerations.generationVersion}), 0)`,
    })
    .from(sceneVideoGenerations)
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.sceneVersionId, input.sceneVersionId),
      ),
    );
  return Number(row?.highest ?? 0) + 1;
}

/** Every attempt for a scene version, newest first. */
export async function listSceneClipsForSceneVersion(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
}) {
  return getDatabase()
    .select()
    .from(sceneVideoGenerations)
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.sceneVersionId, input.sceneVersionId),
      ),
    )
    .orderBy(desc(sceneVideoGenerations.createdAt))
    .limit(MAX_CLIPS_PER_SCENE);
}

/**
 * The clip a render should use for a scene, if any.
 *
 * A null `outputVariantId` means the project's own shape, which is how the
 * approved-uniqueness index stores it. Matching on `is null` rather than on
 * equality is therefore deliberate: a clip made for the project's own shape
 * must not be picked up by a render of a different shape.
 */
export async function findApprovedSceneClip(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  outputVariantId: string | null;
}) {
  const [row] = await getDatabase()
    .select()
    .from(sceneVideoGenerations)
    .where(
      and(
        eq(sceneVideoGenerations.workspaceId, input.workspaceId),
        eq(sceneVideoGenerations.projectId, input.projectId),
        eq(sceneVideoGenerations.sceneVersionId, input.sceneVersionId),
        input.outputVariantId === null
          ? isNull(sceneVideoGenerations.outputVariantId)
          : eq(sceneVideoGenerations.outputVariantId, input.outputVariantId),
        eq(sceneVideoGenerations.reviewStatus, "approved"),
        eq(sceneVideoGenerations.status, "succeeded"),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** The reservation holding this clip's money, for reconciling or releasing it. */
export async function findSceneClipReservation(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.projectId, input.projectId),
        eq(usageReservations.operationType, "scene_video_generation"),
        eq(usageReservations.clipGenerationId, input.generationId),
      ),
    )
    .limit(1);
  return row ?? null;
}
