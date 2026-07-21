import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  videoPublications,
  type ContentPlatform,
  type PublicationVisibility,
  type VideoPublication,
} from "@/db/schema";

export async function createVideoPublication(input: {
  id: string;
  workspaceId: string;
  projectId: string;
  renderId: string;
  connectionId: string;
  platform: ContentPlatform;
  title: string;
  description: string;
  tags: string[];
  visibility: PublicationVisibility;
  idempotencyKey: string;
  requestedByUserId: string;
}): Promise<VideoPublication> {
  const [publication] = await getDatabase()
    .insert(videoPublications)
    .values({
      id: input.id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      renderId: input.renderId,
      connectionId: input.connectionId,
      platform: input.platform,
      title: input.title,
      description: input.description,
      tags: input.tags,
      visibility: input.visibility,
      idempotencyKey: input.idempotencyKey,
      requestedByUserId: input.requestedByUserId,
    })
    .returning();
  if (!publication) throw new Error("VIDEO_PUBLICATION_INSERT_FAILED");
  return publication;
}

export async function attachVideoPublicationTriggerRun(input: {
  publicationId: string;
  triggerRunId: string;
}): Promise<void> {
  await getDatabase()
    .update(videoPublications)
    .set({
      triggerRunId: input.triggerRunId,
      status: "queued",
      progressPercent: 5,
      updatedAt: new Date(),
    })
    .where(eq(videoPublications.id, input.publicationId));
}

export async function markVideoPublicationUploading(input: {
  publicationId: string;
  attemptCount: number;
}): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(videoPublications)
    .set({
      status: "uploading",
      progressPercent: 10,
      attemptCount: input.attemptCount,
      startedAt: now,
      updatedAt: now,
    })
    .where(eq(videoPublications.id, input.publicationId));
}

/**
 * Progress-only update. Guarded to the `uploading` state so a late chunk
 * callback can never resurrect a publication that already finished or failed.
 */
export async function updateVideoPublicationProgress(input: {
  publicationId: string;
  progressPercent: number;
  uploadedBytes: number;
}): Promise<void> {
  const clamped = Math.min(99, Math.max(0, Math.round(input.progressPercent)));
  await getDatabase()
    .update(videoPublications)
    .set({
      progressPercent: clamped,
      uploadedBytes: input.uploadedBytes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(videoPublications.id, input.publicationId),
        eq(videoPublications.status, "uploading"),
      ),
    );
}

export async function completeVideoPublication(input: {
  publicationId: string;
  externalVideoId: string;
  externalVideoUrl: string;
  uploadedBytes: number;
}): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(videoPublications)
    .set({
      status: "succeeded",
      progressPercent: 100,
      externalVideoId: input.externalVideoId,
      externalVideoUrl: input.externalVideoUrl,
      uploadedBytes: input.uploadedBytes,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(videoPublications.id, input.publicationId));
}

export async function failVideoPublication(input: {
  publicationId: string;
  category: string;
  message: string;
}): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(videoPublications)
    .set({
      status: "failed",
      errorCategory: input.category,
      safeErrorMessage: input.message,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(videoPublications.id, input.publicationId));
}

/**
 * Cancel a publication that has not started uploading. Once bytes are in flight
 * the upload cannot be safely revoked — YouTube may already have created the
 * video — so `uploading` is deliberately not cancellable.
 */
export async function cancelVideoPublication(input: {
  workspaceId: string;
  projectId: string;
  publicationId: string;
}): Promise<{ cancelled: boolean }> {
  const now = new Date();
  const result = await getDatabase()
    .update(videoPublications)
    .set({
      status: "cancelled",
      progressPercent: 100,
      errorCategory: "cancelled",
      safeErrorMessage: "Publishing was cancelled before it started.",
      completedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(videoPublications.id, input.publicationId),
        eq(videoPublications.workspaceId, input.workspaceId),
        eq(videoPublications.projectId, input.projectId),
        eq(videoPublications.status, "queued"),
      ),
    )
    .returning({ id: videoPublications.id });
  return { cancelled: result.length === 1 };
}
