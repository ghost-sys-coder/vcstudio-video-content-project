import "server-only";

import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  sceneAudioGenerations,
  sceneImageGenerations,
  thumbnailGenerations,
  videoRenders,
  storageReconciliationCheckpoints,
  workspaces,
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

const ABANDONED_UPLOAD_SWEEP = "abandoned_workspace_uploads";
const ASSET_HEALTH_SWEEP = "successful_asset_health";

export async function getAbandonedUploadCheckpoint(): Promise<string | null> {
  const [row] = await getDatabase()
    .select({ lastObjectKey: storageReconciliationCheckpoints.lastObjectKey })
    .from(storageReconciliationCheckpoints)
    .where(eq(storageReconciliationCheckpoints.sweep, ABANDONED_UPLOAD_SWEEP))
    .limit(1);
  return row?.lastObjectKey ?? null;
}

export async function saveAbandonedUploadCheckpoint(
  lastObjectKey: string | null,
): Promise<void> {
  await getDatabase()
    .insert(storageReconciliationCheckpoints)
    .values({ sweep: ABANDONED_UPLOAD_SWEEP, lastObjectKey })
    .onConflictDoUpdate({
      target: storageReconciliationCheckpoints.sweep,
      set: { lastObjectKey, updatedAt: new Date() },
    });
}

export async function getAssetHealthCheckpoint(): Promise<string | null> {
  const [row] = await getDatabase()
    .select({ lastObjectKey: storageReconciliationCheckpoints.lastObjectKey })
    .from(storageReconciliationCheckpoints)
    .where(eq(storageReconciliationCheckpoints.sweep, ASSET_HEALTH_SWEEP))
    .limit(1);
  return row?.lastObjectKey ?? null;
}

export async function saveAssetHealthCheckpoint(
  lastObjectKey: string | null,
): Promise<void> {
  await getDatabase()
    .insert(storageReconciliationCheckpoints)
    .values({ sweep: ASSET_HEALTH_SWEEP, lastObjectKey })
    .onConflictDoUpdate({
      target: storageReconciliationCheckpoints.sweep,
      set: { lastObjectKey, updatedAt: new Date() },
    });
}

export async function listSuccessfulAssetHealthCandidates(input: {
  startAfter: string | null;
  limit: number;
}): Promise<{
  candidates: StorageReconciliationCandidate[];
  nextStartAfter: string | null;
}> {
  const cursor = input.startAfter ?? "";
  const result = await getDatabase().execute<{
    id: string;
    family: ReconciledAssetFamily;
    workspace_id: string;
    project_id: string;
    status: string;
    object_key: string;
  }>(sql`
    select * from (
      select id, case when purpose = 'variant_outpaint' then 'scene_outpaint' else 'scene_image' end as family, workspace_id, project_id, status::text, asset_object_key as object_key from scene_image_generations where status = 'succeeded' and asset_object_key is not null
      union all select id, 'scene_audio', workspace_id, project_id, status::text, asset_object_key from scene_audio_generations where status = 'succeeded' and asset_object_key is not null
      union all select id, 'thumbnail', workspace_id, project_id, status::text, asset_object_key from thumbnail_generations where status = 'succeeded' and asset_object_key is not null
      union all select id, 'video_export', workspace_id, project_id, status::text, asset_object_key from video_renders where status = 'succeeded' and asset_object_key is not null
    ) assets where object_key > ${cursor} order by object_key asc limit ${input.limit}
  `);
  const candidates = result.rows.map((row) => ({
    id: row.id,
    family: row.family,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    status: row.status,
    objectKey: row.object_key,
  }));
  return {
    candidates,
    nextStartAfter:
      candidates.length === input.limit ? candidates.at(-1)!.objectKey : null,
  };
}

export async function isStorageObjectReferenced(
  objectKey: string,
): Promise<boolean> {
  const result = await getDatabase().execute<{ present: boolean }>(sql`
    select exists (
      select 1 from storage_objects where object_key = ${objectKey}
      union all select 1 from media_assets where object_key = ${objectKey}
      union all select 1 from character_reference_assets where object_key = ${objectKey}
      union all select 1 from scene_image_generations where asset_object_key = ${objectKey}
      union all select 1 from scene_audio_generations where asset_object_key = ${objectKey}
      union all select 1 from thumbnail_generations where asset_object_key = ${objectKey}
      union all select 1 from video_renders where asset_object_key = ${objectKey}
      union all select 1 from marketing_knowledge_documents where object_key = ${objectKey}
    ) as present
  `);
  return result.rows[0]?.present === true;
}

export async function workspaceExists(workspaceId: string): Promise<boolean> {
  const [row] = await getDatabase()
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return Boolean(row);
}

export async function finalizeStorageReconciliation(
  input: StorageReconciliationCandidate & {
    issue: "leaked" | "missing" | "missing_object";
  },
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
    const pointerCondition =
      input.issue === "missing_object"
        ? eq(table.assetObjectKey, input.objectKey!)
        : isNull(table.assetObjectKey);
    return database
      .update(table)
      .set({
        status: "failed",
        errorCategory: "stored_asset_missing",
        safeErrorMessage:
          "The stored asset is missing. Create a new version to repair it.",
        updatedAt: new Date(),
      })
      .where(and(common, pointerCondition))
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
