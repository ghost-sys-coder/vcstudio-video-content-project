import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets, sceneAudioGenerations } from "@/db/schema";
import type { VerifiedMediaMetadata } from "@/lib/media/media-inspection";

export async function prepareMediaAssetInspection(input: {
  workspaceId: string;
  mediaAssetId: string;
  sizeBytes: number;
  triggerRunId?: string;
}) {
  const [asset] = await getDatabase()
    .update(mediaAssets)
    .set({
      sizeBytes: input.sizeBytes,
      inspectionStatus: "pending",
      inspectionTriggerRunId: input.triggerRunId,
      inspectionError: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaAssets.workspaceId, input.workspaceId),
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.kind, "video"),
        eq(mediaAssets.status, "pending"),
      ),
    )
    .returning();
  if (!asset) throw new Error("MEDIA_ASSET_INSPECTION_CONFLICT");
  return asset;
}

export async function attachMediaAssetInspectionRun(input: {
  workspaceId: string;
  mediaAssetId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(mediaAssets)
    .set({ inspectionTriggerRunId: input.triggerRunId, updatedAt: new Date() })
    .where(
      and(
        eq(mediaAssets.workspaceId, input.workspaceId),
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.inspectionStatus, "pending"),
      ),
    );
}

export async function completeMediaAssetInspection(input: {
  workspaceId: string;
  mediaAssetId: string;
  metadata: VerifiedMediaMetadata;
  warnings: string[];
}) {
  if (input.metadata.kind !== "video")
    throw new Error("MEDIA_ASSET_VIDEO_METADATA_REQUIRED");
  const [asset] = await getDatabase()
    .update(mediaAssets)
    .set({
      status: "ready",
      inspectionStatus: "succeeded",
      verifiedMetadata: input.metadata,
      inspectionWarnings: input.warnings,
      inspectionError: null,
      width: input.metadata.displayWidth,
      height: input.metadata.displayHeight,
      durationMilliseconds: input.metadata.durationMilliseconds,
      inspectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaAssets.workspaceId, input.workspaceId),
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.status, "pending"),
        inArray(mediaAssets.inspectionStatus, ["pending", "running"]),
      ),
    )
    .returning();
  if (!asset) throw new Error("MEDIA_ASSET_INSPECTION_COMPLETION_CONFLICT");
  return asset;
}

export async function failMediaAssetInspection(input: {
  workspaceId: string;
  mediaAssetId: string;
  message: string;
}) {
  await getDatabase()
    .update(mediaAssets)
    .set({
      status: "failed",
      inspectionStatus: "failed",
      inspectionError: input.message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(mediaAssets.workspaceId, input.workspaceId),
        eq(mediaAssets.id, input.mediaAssetId),
        eq(mediaAssets.status, "pending"),
      ),
    );
}

export async function prepareRecordedAudioInspection(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  triggerRunId?: string;
}) {
  const [generation] = await getDatabase()
    .update(sceneAudioGenerations)
    .set({
      inspectionStatus: "pending",
      inspectionTriggerRunId: input.triggerRunId,
      inspectionError: null,
      amplitudeEnvelope: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.id, input.generationId),
        eq(sceneAudioGenerations.source, "user_recorded"),
      ),
    )
    .returning();
  if (!generation) throw new Error("RECORDED_AUDIO_INSPECTION_CONFLICT");
  return generation;
}

export async function attachRecordedAudioInspectionRun(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(sceneAudioGenerations)
    .set({ inspectionTriggerRunId: input.triggerRunId, updatedAt: new Date() })
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.id, input.generationId),
        eq(sceneAudioGenerations.inspectionStatus, "pending"),
      ),
    );
}

export async function completeRecordedAudioInspection(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  metadata: VerifiedMediaMetadata;
  warnings: string[];
  amplitudeEnvelope: number[];
}) {
  if (input.metadata.kind !== "audio")
    throw new Error("RECORDED_AUDIO_METADATA_REQUIRED");
  const [generation] = await getDatabase()
    .update(sceneAudioGenerations)
    .set({
      inspectionStatus: "succeeded",
      verifiedMetadata: input.metadata,
      inspectionWarnings: input.warnings,
      inspectionError: null,
      durationMilliseconds: input.metadata.durationMilliseconds,
      sampleRate: input.metadata.sampleRate,
      amplitudeEnvelope: input.amplitudeEnvelope,
      inspectedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.id, input.generationId),
        eq(sceneAudioGenerations.source, "user_recorded"),
        inArray(sceneAudioGenerations.inspectionStatus, ["pending", "running"]),
      ),
    )
    .returning();
  if (!generation)
    throw new Error("RECORDED_AUDIO_INSPECTION_COMPLETION_CONFLICT");
  return generation;
}

export async function failRecordedAudioInspection(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  message: string;
}) {
  await getDatabase()
    .update(sceneAudioGenerations)
    .set({
      inspectionStatus: "failed",
      inspectionError: input.message,
      amplitudeEnvelope: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.id, input.generationId),
        eq(sceneAudioGenerations.source, "user_recorded"),
      ),
    );
}
