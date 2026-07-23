import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
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
  return getDatabase()
    .select({
      generationId: sceneImageGenerations.id,
      sceneVersionId: sceneImageGenerations.sceneVersionId,
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
    .limit(MAX_SCENE_VERSIONS);
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
  return getDatabase()
    .select({
      generationId: sceneAudioGenerations.id,
      sceneVersionId: sceneAudioGenerations.sceneVersionId,
      assetObjectKey: sceneAudioGenerations.assetObjectKey,
      durationMilliseconds: sceneAudioGenerations.durationMilliseconds,
      format: sceneAudioGenerations.format,
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
}
