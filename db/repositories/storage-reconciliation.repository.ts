import "server-only";

import { and, asc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  sceneAudioGenerations,
  sceneImageGenerations,
  thumbnailGenerations,
  videoRenders,
} from "@/db/schema";
import type { ReconciledAssetFamily } from "@/lib/reconciliation/orphan-assets";

export type StorageReconciliationCandidate = {
  id: string;
  family: ReconciledAssetFamily;
  workspaceId: string;
  projectId: string;
  status: string;
  objectKey: string | null;
};

const terminal = ["failed", "cancelled"] as const;

export async function listStorageReconciliationCandidates(input: {
  limit: number;
}): Promise<StorageReconciliationCandidate[]> {
  const perFamily = input.limit;
  const database = getDatabase();
  const [images, audio, thumbnails, renders] = await Promise.all([
    database
      .select({
        id: sceneImageGenerations.id,
        workspaceId: sceneImageGenerations.workspaceId,
        projectId: sceneImageGenerations.projectId,
        status: sceneImageGenerations.status,
        objectKey: sceneImageGenerations.assetObjectKey,
        purpose: sceneImageGenerations.purpose,
      })
      .from(sceneImageGenerations)
      .where(
        or(
          and(
            inArray(sceneImageGenerations.status, terminal),
            isNotNull(sceneImageGenerations.assetObjectKey),
          ),
          and(
            eq(sceneImageGenerations.status, "succeeded"),
            isNull(sceneImageGenerations.assetObjectKey),
          ),
        ),
      )
      .orderBy(
        asc(sceneImageGenerations.updatedAt),
        asc(sceneImageGenerations.id),
      )
      .limit(perFamily),
    database
      .select({
        id: sceneAudioGenerations.id,
        workspaceId: sceneAudioGenerations.workspaceId,
        projectId: sceneAudioGenerations.projectId,
        status: sceneAudioGenerations.status,
        objectKey: sceneAudioGenerations.assetObjectKey,
      })
      .from(sceneAudioGenerations)
      .where(
        or(
          and(
            inArray(sceneAudioGenerations.status, terminal),
            isNotNull(sceneAudioGenerations.assetObjectKey),
          ),
          and(
            eq(sceneAudioGenerations.status, "succeeded"),
            isNull(sceneAudioGenerations.assetObjectKey),
          ),
        ),
      )
      .orderBy(
        asc(sceneAudioGenerations.updatedAt),
        asc(sceneAudioGenerations.id),
      )
      .limit(perFamily),
    database
      .select({
        id: thumbnailGenerations.id,
        workspaceId: thumbnailGenerations.workspaceId,
        projectId: thumbnailGenerations.projectId,
        status: thumbnailGenerations.status,
        objectKey: thumbnailGenerations.assetObjectKey,
      })
      .from(thumbnailGenerations)
      .where(
        or(
          and(
            inArray(thumbnailGenerations.status, terminal),
            isNotNull(thumbnailGenerations.assetObjectKey),
          ),
          and(
            eq(thumbnailGenerations.status, "succeeded"),
            isNull(thumbnailGenerations.assetObjectKey),
          ),
        ),
      )
      .orderBy(
        asc(thumbnailGenerations.updatedAt),
        asc(thumbnailGenerations.id),
      )
      .limit(perFamily),
    database
      .select({
        id: videoRenders.id,
        workspaceId: videoRenders.workspaceId,
        projectId: videoRenders.projectId,
        status: videoRenders.status,
        objectKey: videoRenders.assetObjectKey,
      })
      .from(videoRenders)
      .where(
        or(
          and(
            inArray(videoRenders.status, terminal),
            isNotNull(videoRenders.assetObjectKey),
          ),
          and(
            eq(videoRenders.status, "succeeded"),
            isNull(videoRenders.assetObjectKey),
          ),
        ),
      )
      .orderBy(asc(videoRenders.updatedAt), asc(videoRenders.id))
      .limit(perFamily),
  ]);
  return [
    ...images.map(({ purpose, ...row }) => ({
      ...row,
      family:
        purpose === "variant_outpaint"
          ? ("scene_outpaint" as const)
          : ("scene_image" as const),
    })),
    ...audio.map((row) => ({ ...row, family: "scene_audio" as const })),
    ...thumbnails.map((row) => ({ ...row, family: "thumbnail" as const })),
    ...renders.map((row) => ({ ...row, family: "video_export" as const })),
  ].slice(0, input.limit);
}

export async function finalizeStorageReconciliation(
  input: StorageReconciliationCandidate & { issue: "leaked" | "missing" },
): Promise<boolean> {
  const database = getDatabase();
  const finish = async (
    table:
      | typeof sceneImageGenerations
      | typeof sceneAudioGenerations
      | typeof thumbnailGenerations
      | typeof videoRenders,
  ) => {
    const status = input.status as
      "pending" | "queued" | "running" | "succeeded" | "failed" | "cancelled";
    const common = and(
      eq(table.id, input.id),
      eq(table.workspaceId, input.workspaceId),
      eq(table.projectId, input.projectId),
      eq(table.status, status),
    );
    if (input.issue === "leaked")
      return database
        .update(table)
        .set({
          assetObjectKey: null,
          assetContentType: null,
          assetSizeBytes: null,
          assetEtag: null,
          updatedAt: new Date(),
        })
        .where(and(common, eq(table.assetObjectKey, input.objectKey!)))
        .returning({ id: table.id });
    return database
      .update(table)
      .set({
        status: "failed",
        errorCategory: "stored_asset_missing",
        safeErrorMessage:
          "The stored asset is missing. Create a new version to repair it.",
        updatedAt: new Date(),
      })
      .where(and(common, isNull(table.assetObjectKey)))
      .returning({ id: table.id });
  };
  const rows =
    input.family === "scene_audio"
      ? await finish(sceneAudioGenerations)
      : input.family === "thumbnail"
        ? await finish(thumbnailGenerations)
        : input.family === "video_export"
          ? await finish(videoRenders)
          : await finish(sceneImageGenerations);
  return rows.length === 1;
}
