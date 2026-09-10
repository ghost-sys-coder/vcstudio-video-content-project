import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { releaseSchedules, type ReleaseSchedule } from "@/db/schema";

/** How many schedules one project's panel ever shows. */
const PROJECT_SCHEDULE_LIMIT = 100;

/**
 * The schedules belonging to one project.
 *
 * Scoped by workspace as well as project, and bounded, so a project that has
 * been rescheduled many times cannot make the publish page unbounded.
 */
export async function listReleaseSchedules(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ReleaseSchedule[]> {
  return getDatabase()
    .select()
    .from(releaseSchedules)
    .where(
      and(
        eq(releaseSchedules.workspaceId, input.workspaceId),
        eq(releaseSchedules.projectId, input.projectId),
      ),
    )
    .orderBy(desc(releaseSchedules.scheduledAt), desc(releaseSchedules.id))
    .limit(PROJECT_SCHEDULE_LIMIT);
}

export async function findReleaseSchedule(input: {
  workspaceId: string;
  projectId: string;
  scheduleId: string;
}): Promise<ReleaseSchedule | null> {
  const [row] = await getDatabase()
    .select()
    .from(releaseSchedules)
    .where(
      and(
        eq(releaseSchedules.id, input.scheduleId),
        eq(releaseSchedules.workspaceId, input.workspaceId),
        eq(releaseSchedules.projectId, input.projectId),
      ),
    )
    .limit(1);
  return row ?? null;
}
