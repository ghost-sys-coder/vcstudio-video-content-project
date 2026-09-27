import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  chapterGenerationRuns,
  usageReservations,
  videoRenderChapters,
  type ChapterGenerationRun,
  type UsageReservation,
  type VideoRenderChapters,
} from "@/db/schema";

export async function findChapterGenerationRun(input: {
  workspaceId: string;
  projectId: string;
  chapterGenerationRunId: string;
}): Promise<ChapterGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(chapterGenerationRuns)
    .where(
      and(
        eq(chapterGenerationRuns.workspaceId, input.workspaceId),
        eq(chapterGenerationRuns.projectId, input.projectId),
        eq(chapterGenerationRuns.id, input.chapterGenerationRunId),
      ),
    )
    .limit(1);
  return run ?? null;
}

export async function findChapterGenerationRunByIdempotencyKey(input: {
  workspaceId: string;
  idempotencyKey: string;
}): Promise<ChapterGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(chapterGenerationRuns)
    .where(
      and(
        eq(chapterGenerationRuns.workspaceId, input.workspaceId),
        eq(chapterGenerationRuns.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return run ?? null;
}

export async function findChapterGenerationReservation(input: {
  workspaceId: string;
  chapterGenerationRunId: string;
}): Promise<UsageReservation | null> {
  const [reservation] = await getDatabase()
    .select()
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.chapterGenerationId, input.chapterGenerationRunId),
      ),
    )
    .limit(1);
  return reservation ?? null;
}

export async function findLatestChapterGenerationRunForRender(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
}): Promise<ChapterGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(chapterGenerationRuns)
    .where(
      and(
        eq(chapterGenerationRuns.workspaceId, input.workspaceId),
        eq(chapterGenerationRuns.projectId, input.projectId),
        eq(chapterGenerationRuns.renderId, input.renderId),
      ),
    )
    .orderBy(desc(chapterGenerationRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function findVideoRenderChapters(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
}): Promise<VideoRenderChapters | null> {
  const [row] = await getDatabase()
    .select()
    .from(videoRenderChapters)
    .where(
      and(
        eq(videoRenderChapters.workspaceId, input.workspaceId),
        eq(videoRenderChapters.projectId, input.projectId),
        eq(videoRenderChapters.renderId, input.renderId),
      ),
    )
    .limit(1);
  return row ?? null;
}
