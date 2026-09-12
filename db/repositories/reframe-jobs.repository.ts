import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { projectReframeJobs, sceneImageGenerations } from "@/db/schema";

/** The two states in which a job is still doing something. */
export const ACTIVE_REFRAME_STATUSES = ["extending", "rendering"] as const;

export async function findActiveReframeJob(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(projectReframeJobs)
    .where(
      and(
        eq(projectReframeJobs.workspaceId, input.workspaceId),
        eq(projectReframeJobs.projectId, input.projectId),
        eq(projectReframeJobs.outputVariantId, input.outputVariantId),
        inArray(projectReframeJobs.status, [...ACTIVE_REFRAME_STATUSES]),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * The most recent job for a shape, running or finished.
 *
 * The panel shows the last outcome rather than only a live one, so a creator
 * who closes the page still learns which scenes ended up cropped.
 */
export async function findLatestReframeJob(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(projectReframeJobs)
    .where(
      and(
        eq(projectReframeJobs.workspaceId, input.workspaceId),
        eq(projectReframeJobs.projectId, input.projectId),
        eq(projectReframeJobs.outputVariantId, input.outputVariantId),
      ),
    )
    .orderBy(desc(projectReframeJobs.createdAt))
    .limit(1);
  return row ?? null;
}

export async function findReframeJob(input: {
  workspaceId: string;
  jobId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(projectReframeJobs)
    .where(
      and(
        eq(projectReframeJobs.workspaceId, input.workspaceId),
        eq(projectReframeJobs.id, input.jobId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Each scene's approved still at one size, with whether it was AI-generated.
 *
 * The subtitle repository's equivalent deliberately returns only what a render
 * needs, and a render does not care where an image came from. Planning a
 * reframe does: an uploaded still has no prompt behind it and cannot be
 * extended, so it has to be cropped instead.
 *
 * Ordered by shot so the caller's first-row-wins map takes the image that
 * represents the scene rather than whichever row came back first.
 */
export async function listApprovedSceneImageOrigins(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
  size: string;
}) {
  if (input.sceneVersionIds.length === 0) return [];
  return getDatabase()
    .select({
      generationId: sceneImageGenerations.id,
      sceneVersionId: sceneImageGenerations.sceneVersionId,
      shotIndex: sceneImageGenerations.shotIndex,
      source: sceneImageGenerations.source,
    })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        inArray(sceneImageGenerations.sceneVersionId, input.sceneVersionIds),
        eq(sceneImageGenerations.purpose, "scene"),
        eq(sceneImageGenerations.size, input.size),
        eq(sceneImageGenerations.reviewStatus, "approved"),
        eq(sceneImageGenerations.status, "succeeded"),
      ),
    )
    .orderBy(
      asc(sceneImageGenerations.sceneVersionId),
      asc(sceneImageGenerations.shotIndex),
    )
    .limit(1000);
}

/**
 * The outcome of each extension a job is waiting on.
 *
 * Returned in bulk rather than fetched one at a time because the orchestrator
 * polls this until every extension is finished, and a scene-per-query poll
 * would be one Neon round trip per scene per tick.
 */
export async function listReframeExtensionOutcomes(input: {
  workspaceId: string;
  projectId: string;
  generationIds: string[];
}) {
  if (input.generationIds.length === 0) return [];
  return getDatabase()
    .select({
      generationId: sceneImageGenerations.id,
      sceneId: sceneImageGenerations.sceneId,
      sceneVersionId: sceneImageGenerations.sceneVersionId,
      sourceImageGenerationId: sceneImageGenerations.sourceImageGenerationId,
      status: sceneImageGenerations.status,
      assetObjectKey: sceneImageGenerations.assetObjectKey,
    })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        inArray(sceneImageGenerations.id, input.generationIds),
      ),
    )
    .limit(1000);
}
