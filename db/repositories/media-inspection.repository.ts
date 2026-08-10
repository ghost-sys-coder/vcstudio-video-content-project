import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets, sceneAudioGenerations } from "@/db/schema";

export async function listPendingMediaInspections(limit = 25) {
  const bounded = Math.min(Math.max(limit, 1), 100);
  const [videos, recordings] = await Promise.all([
    getDatabase()
      .select({
        workspaceId: mediaAssets.workspaceId,
        mediaAssetId: mediaAssets.id,
      })
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.kind, "video"),
          eq(mediaAssets.status, "pending"),
          eq(mediaAssets.inspectionStatus, "pending"),
        ),
      )
      .limit(bounded),
    getDatabase()
      .select({
        workspaceId: sceneAudioGenerations.workspaceId,
        projectId: sceneAudioGenerations.projectId,
        generationId: sceneAudioGenerations.id,
      })
      .from(sceneAudioGenerations)
      .where(
        and(
          eq(sceneAudioGenerations.source, "user_recorded"),
          eq(sceneAudioGenerations.status, "succeeded"),
          eq(sceneAudioGenerations.inspectionStatus, "pending"),
        ),
      )
      .limit(bounded),
  ]);
  return { videos, recordings };
}
