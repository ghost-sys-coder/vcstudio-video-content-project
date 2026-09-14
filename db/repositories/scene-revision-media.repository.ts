import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  sceneRevisionMedia,
  sceneImageGenerations,
  sceneAudioGenerations,
} from "@/db/schema";

type Scope = {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
};

export async function listReusedImages(input: Scope) {
  const ids = [...new Set(input.sceneVersionIds)].slice(0, 500);
  if (!ids.length) return [];
  const rows = await getDatabase()
    .select({ binding: sceneRevisionMedia, generation: sceneImageGenerations })
    .from(sceneRevisionMedia)
    .innerJoin(
      sceneImageGenerations,
      and(
        eq(sceneImageGenerations.id, sceneRevisionMedia.imageGenerationId),
        eq(sceneImageGenerations.workspaceId, sceneRevisionMedia.workspaceId),
        eq(sceneImageGenerations.projectId, sceneRevisionMedia.projectId),
        eq(sceneImageGenerations.sceneId, sceneRevisionMedia.sceneId),
        eq(sceneImageGenerations.size, sceneRevisionMedia.slot),
        // Shot as well as size, or a binding for one shot would match every
        // approved image of that size and multiply the scene's pictures.
        eq(sceneImageGenerations.shotIndex, sceneRevisionMedia.shotIndex),
      ),
    )
    .where(
      and(
        eq(sceneRevisionMedia.workspaceId, input.workspaceId),
        eq(sceneRevisionMedia.projectId, input.projectId),
        inArray(sceneRevisionMedia.sceneVersionId, ids),
        eq(sceneImageGenerations.status, "succeeded"),
        eq(sceneImageGenerations.reviewStatus, "approved"),
        eq(sceneImageGenerations.purpose, "scene"),
        isNotNull(sceneImageGenerations.assetObjectKey),
      ),
    )
    .limit(1500);
  return rows.map(({ binding, generation }) => ({
    ...generation,
    sourceSceneVersionId: generation.sceneVersionId,
    sceneVersionId: binding.sceneVersionId,
  }));
}

export async function listReusedAudio(input: Scope) {
  const ids = [...new Set(input.sceneVersionIds)].slice(0, 500);
  if (!ids.length) return [];
  const rows = await getDatabase()
    .select({ binding: sceneRevisionMedia, generation: sceneAudioGenerations })
    .from(sceneRevisionMedia)
    .innerJoin(
      sceneAudioGenerations,
      and(
        eq(sceneAudioGenerations.id, sceneRevisionMedia.audioGenerationId),
        eq(sceneAudioGenerations.workspaceId, sceneRevisionMedia.workspaceId),
        eq(sceneAudioGenerations.projectId, sceneRevisionMedia.projectId),
        eq(sceneAudioGenerations.sceneId, sceneRevisionMedia.sceneId),
      ),
    )
    .where(
      and(
        eq(sceneRevisionMedia.workspaceId, input.workspaceId),
        eq(sceneRevisionMedia.projectId, input.projectId),
        inArray(sceneRevisionMedia.sceneVersionId, ids),
        eq(sceneAudioGenerations.status, "succeeded"),
        eq(sceneAudioGenerations.reviewStatus, "approved"),
        isNotNull(sceneAudioGenerations.assetObjectKey),
      ),
    )
    .limit(500);
  return rows.map(({ binding, generation }) => ({
    ...generation,
    sourceSceneVersionId: generation.sceneVersionId,
    sceneVersionId: binding.sceneVersionId,
  }));
}

/**
 * Native approved media wins; pending replacements never hide usable media.
 *
 * Identity includes the shot, because a scene may hold several images at one
 * size. Keyed on size alone, a freshly approved first shot would suppress the
 * carried-forward second one and the scene would quietly lose a picture.
 */
export function appendReusedMedia<
  T extends {
    sceneVersionId: string;
    reviewStatus: string;
    size?: string;
    shotIndex?: number;
    status: string;
    assetObjectKey: string | null;
  },
>(native: T[], reused: T[]): T[] {
  const identity = (row: T) =>
    row.size === undefined
      ? `${row.sceneVersionId}:audio`
      : `${row.sceneVersionId}:${row.size}:${row.shotIndex ?? 0}`;
  const approved = new Set(
    native
      .filter(
        (row) =>
          row.reviewStatus === "approved" &&
          row.status === "succeeded" &&
          row.assetObjectKey !== null,
      )
      .map(identity),
  );
  return [...native, ...reused.filter((row) => !approved.has(identity(row)))];
}
