import "server-only";

import { getDatabase } from "@/db/drizzle";
import { projectBriefs, type ContentPlatform } from "@/db/schema";

/**
 * Upsert a project's brief (one row per project). Projects created before the
 * brief feature have no row, so this inserts on first save and updates
 * thereafter, keyed by the unique `project_id`.
 */
export async function saveProjectBrief(input: {
  workspaceId: string;
  projectId: string;
  topic: string;
  targetAudience: string;
  tone: string;
  targetDurationSeconds: number | null;
  primaryPlatform: ContentPlatform;
  hookAngle: string;
  niche: string;
  userId: string;
}): Promise<void> {
  const now = new Date();
  await getDatabase()
    .insert(projectBriefs)
    .values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      topic: input.topic,
      targetAudience: input.targetAudience,
      tone: input.tone,
      targetDurationSeconds: input.targetDurationSeconds,
      primaryPlatform: input.primaryPlatform,
      hookAngle: input.hookAngle,
      niche: input.niche,
      updatedByUserId: input.userId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projectBriefs.projectId,
      set: {
        topic: input.topic,
        targetAudience: input.targetAudience,
        tone: input.tone,
        targetDurationSeconds: input.targetDurationSeconds,
        primaryPlatform: input.primaryPlatform,
        hookAngle: input.hookAngle,
        niche: input.niche,
        updatedByUserId: input.userId,
        updatedAt: now,
      },
    });
}
