import "server-only";

import { randomUUID } from "node:crypto";
import { getDatabase } from "@/db/drizzle";
import { projectSubtitleSettings } from "@/db/schema";
import type {
  CaptionStyleData,
  SubtitleGranularity,
  SubtitleSegmentTextOverrides,
} from "@/lib/subtitles/caption-style-data";

/**
 * Creates or updates the single subtitle settings row for a project. The unique
 * index on `project_id` makes this an idempotent upsert scoped to the workspace.
 */
export async function upsertProjectSubtitleSettings(input: {
  workspaceId: string;
  projectId: string;
  updatedByUserId: string;
  granularity: SubtitleGranularity;
  captionStyle: CaptionStyleData;
  segmentTextOverrides: SubtitleSegmentTextOverrides;
}) {
  const now = new Date();
  const [row] = await getDatabase()
    .insert(projectSubtitleSettings)
    .values({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      granularity: input.granularity,
      captionStyle: input.captionStyle,
      segmentTextOverrides: input.segmentTextOverrides,
      updatedByUserId: input.updatedByUserId,
    })
    .onConflictDoUpdate({
      target: projectSubtitleSettings.projectId,
      set: {
        granularity: input.granularity,
        captionStyle: input.captionStyle,
        segmentTextOverrides: input.segmentTextOverrides,
        updatedByUserId: input.updatedByUserId,
        updatedAt: now,
      },
    })
    .returning();
  if (!row) throw new Error("SUBTITLE_SETTINGS_UPSERT_FAILED");
  return row;
}
