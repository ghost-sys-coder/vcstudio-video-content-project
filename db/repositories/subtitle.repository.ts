import "server-only";

import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { MAX_SHOTS_PER_SCENE } from "@/lib/scenes/shot-timing";
import {
  listReusedImages,
  listReusedAudio,
} from "@/db/repositories/scene-revision-media.repository";
import {
  projectSubtitleSettings,
  sceneAudioGenerations,
  sceneImageGenerations,
} from "@/db/schema";

const MAX_SCENE_VERSIONS = 500;

export async function getProjectSubtitleSettings(input: {
  workspaceId: string;
  projectId: string;
}) {
  const [row] = await getDatabase()
    .select()
    .from(projectSubtitleSettings)
    .where(
      and(
        eq(projectSubtitleSettings.workspaceId, input.workspaceId),
        eq(projectSubtitleSettings.projectId, input.projectId),
      ),
    )
    .limit(1);
  return row ?? null;
}

function scopedSceneVersionIds(sceneVersionIds: string[]): string[] {
  return [...new Set(sceneVersionIds)].slice(0, MAX_SCENE_VERSIONS);
}

/**
 * Returns the approved, delivered image per scene version AT ONE SIZE. A
 * scene version can now have an approved image per size (one of the three
 * literal OpenAI sizes), so `size` is required — the partial unique index
 * only guarantees at most one approved image per `(sceneVersionId, size)`
 * pair, not per scene version overall. Callers resolving "the primary
 * approved image" must pass the project's canonical size explicitly.
 */
export async function listApprovedSceneImageAssets(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
  size: string;
}) {
  const sceneVersionIds = scopedSceneVersionIds(input.sceneVersionIds);
  if (!sceneVersionIds.length) return [];
  const native = await getDatabase()
    .select({
      generationId: sceneImageGenerations.id,
      sceneVersionId: sceneImageGenerations.sceneVersionId,
      shotIndex: sceneImageGenerations.shotIndex,
      assetObjectKey: sceneImageGenerations.assetObjectKey,
      assetWidth: sceneImageGenerations.assetWidth,
      assetHeight: sceneImageGenerations.assetHeight,
    })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        inArray(sceneImageGenerations.sceneVersionId, sceneVersionIds),
        eq(sceneImageGenerations.purpose, "scene"),
        eq(sceneImageGenerations.size, input.size),
        eq(sceneImageGenerations.reviewStatus, "approved"),
        eq(sceneImageGenerations.status, "succeeded"),
        isNotNull(sceneImageGenerations.assetObjectKey),
      ),
    )
    // Ordered because a scene version may now hold several approved images,
    // one per shot. Without an explicit order the caller's "first row wins"
    // map would pick whichever row the planner returned first, and a render
    // would not reproduce. The limit is raised in step, since the old ceiling
    // assumed one row per scene version.
    .orderBy(
      asc(sceneImageGenerations.sceneVersionId),
      asc(sceneImageGenerations.shotIndex),
    )
    .limit(MAX_SCENE_VERSIONS * MAX_SHOTS_PER_SCENE);
  const present = new Set(native.map((row) => row.sceneVersionId));
  const reused = await listReusedImages({ ...input, sceneVersionIds });
  return [
    ...native,
    ...reused
      .filter(
        (row) => row.size === input.size && !present.has(row.sceneVersionId),
      )
      .map((row) => ({
        generationId: row.id,
        sceneVersionId: row.sceneVersionId,
        // A reused image carried across a scene revision is always the
        // scene's first image; multi-image reuse is not carried across.
        shotIndex: 0,
        assetObjectKey: row.assetObjectKey,
        assetWidth: row.assetWidth,
        assetHeight: row.assetHeight,
      })),
  ];
}

/**
 * Returns the single approved, delivered narration audio per scene version.
 */
export async function listApprovedSceneAudioAssets(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
}) {
  const sceneVersionIds = scopedSceneVersionIds(input.sceneVersionIds);
  if (!sceneVersionIds.length) return [];
  const native = await getDatabase()
    .select({
      generationId: sceneAudioGenerations.id,
      sceneVersionId: sceneAudioGenerations.sceneVersionId,
      assetObjectKey: sceneAudioGenerations.assetObjectKey,
      durationMilliseconds: sceneAudioGenerations.durationMilliseconds,
      format: sceneAudioGenerations.format,
      amplitudeEnvelope: sceneAudioGenerations.amplitudeEnvelope,
    })
    .from(sceneAudioGenerations)
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        inArray(sceneAudioGenerations.sceneVersionId, sceneVersionIds),
        eq(sceneAudioGenerations.reviewStatus, "approved"),
        eq(sceneAudioGenerations.status, "succeeded"),
        isNotNull(sceneAudioGenerations.assetObjectKey),
      ),
    )
    .limit(MAX_SCENE_VERSIONS);
  const present = new Set(native.map((row) => row.sceneVersionId));
  const reused = await listReusedAudio({ ...input, sceneVersionIds });
  return [
    ...native,
    ...reused
      .filter((row) => !present.has(row.sceneVersionId))
      .map((row) => ({
        generationId: row.id,
        sceneVersionId: row.sceneVersionId,
        assetObjectKey: row.assetObjectKey,
        durationMilliseconds: row.durationMilliseconds,
        format: row.format,
        amplitudeEnvelope: row.amplitudeEnvelope,
      })),
  ];
}

/**
 * The approved narration for one scene version, or `null` when there is none.
 *
 * Delegates to the list query rather than writing a second one, so the rule for
 * what counts as approved narration, including audio reused from an earlier
 * revision, stays in a single place. Two queries would drift, and this one
 * decides which recording a caption correction is allowed to describe.
 */
export async function findApprovedSceneAudioForVersion(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
}) {
  const rows = await listApprovedSceneAudioAssets({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sceneVersionIds: [input.sceneVersionId],
  });
  return rows[0] ?? null;
}
