import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { releaseSchedules, type ReleaseSchedule } from "@/db/schema";
import type { VideoContentPlatform } from "@/lib/platforms/video-content-platforms";

/** A schedule already exists for this exact destination. */
export class ReleaseAlreadyScheduledError extends Error {
  readonly code = "RELEASE_ALREADY_SCHEDULED";

  constructor() {
    super("That render is already scheduled for this channel.");
    this.name = "ReleaseAlreadyScheduledError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

/**
 * Records the intention to publish one render to one channel at one instant.
 *
 * The partial unique index does the work of preventing a double booking: two
 * clicks, or two tabs, cannot leave two live schedules pointing at the same
 * destination, and the second insert fails at the database rather than relying
 * on a check-then-insert that a concurrent request could slip between.
 */
export async function scheduleRelease(input: {
  workspaceId: string;
  projectId: string;
  releasePackageId: string;
  renderId: string;
  connectionId: string;
  platform: VideoContentPlatform;
  scheduledAt: Date;
  timeZone: string;
  requestedByUserId: string;
}): Promise<ReleaseSchedule> {
  try {
    const [created] = await getDatabase()
      .insert(releaseSchedules)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        releasePackageId: input.releasePackageId,
        renderId: input.renderId,
        connectionId: input.connectionId,
        platform: input.platform,
        scheduledAt: input.scheduledAt,
        timeZone: input.timeZone,
        requestedByUserId: input.requestedByUserId,
      })
      .returning();
    if (!created) throw new Error("The schedule could not be created.");
    return created;
  } catch (error) {
    if (isUniqueViolation(error)) throw new ReleaseAlreadyScheduledError();
    throw error;
  }
}

/**
 * Calls off a schedule that has not been picked up yet.
 *
 * Scoped by workspace and project, and conditional on the row still being
 * `scheduled`: a cancel that races the sweeper's claim must lose, because by
 * then the upload is already being handed over and the two records would
 * otherwise disagree about what happened.
 */
export async function cancelReleaseSchedule(input: {
  workspaceId: string;
  projectId: string;
  scheduleId: string;
}): Promise<{ cancelled: boolean }> {
  const updated = await getDatabase()
    .update(releaseSchedules)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(releaseSchedules.id, input.scheduleId),
        eq(releaseSchedules.workspaceId, input.workspaceId),
        eq(releaseSchedules.projectId, input.projectId),
        eq(releaseSchedules.status, "scheduled"),
      ),
    )
    .returning({ id: releaseSchedules.id });
  return { cancelled: updated.length > 0 };
}

/**
 * Takes ownership of the schedules that have come due.
 *
 * `for update skip locked` makes the claim atomic, so two workers, or a sweep
 * overlapping a slow previous one, cannot dispatch the same release twice. The
 * status moves to `claimed` in the same statement that selects it, so a row is
 * never visible as due to a second sweep.
 */
export async function claimDueReleaseSchedules(input: {
  limit: number;
  now?: Date;
}): Promise<
  {
    id: string;
    workspaceId: string;
    projectId: string;
    releasePackageId: string;
    renderId: string;
    connectionId: string;
  }[]
> {
  const now = input.now ?? new Date();
  const result = await getDatabase().execute<{
    id: string;
    workspace_id: string;
    project_id: string;
    release_package_id: string;
    render_id: string;
    connection_id: string;
  }>(sql`
    update release_schedules
    set status = 'claimed', claimed_at = now(), updated_at = now()
    where id in (
      select id from release_schedules
      where status = 'scheduled' and scheduled_at <= ${now}
      order by scheduled_at
      limit ${input.limit}
      for update skip locked
    )
    returning id, workspace_id, project_id, release_package_id, render_id, connection_id
  `);
  return result.rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    releasePackageId: row.release_package_id,
    renderId: row.render_id,
    connectionId: row.connection_id,
  }));
}

/** Records that the upload was handed to the publication worker. */
export async function markReleaseScheduleDispatched(input: {
  workspaceId: string;
  scheduleId: string;
  publicationId: string;
}): Promise<void> {
  await getDatabase()
    .update(releaseSchedules)
    .set({
      status: "dispatched",
      publicationId: input.publicationId,
      dispatchedAt: new Date(),
      updatedAt: new Date(),
      attemptCount: sql`${releaseSchedules.attemptCount} + 1`,
    })
    .where(
      and(
        eq(releaseSchedules.id, input.scheduleId),
        eq(releaseSchedules.workspaceId, input.workspaceId),
      ),
    );
}

/**
 * Records that the release could not be started.
 *
 * The message is the safe one shown to a creator, never a provider's raw
 * error. The schedule stays failed rather than being retried automatically:
 * publishing is not free of consequence, and a release that failed because the
 * render was deleted or the channel was revoked would fail identically every
 * time while looking like the system was still trying.
 */
export async function markReleaseScheduleFailed(input: {
  workspaceId: string;
  scheduleId: string;
  safeErrorMessage: string;
}): Promise<void> {
  await getDatabase()
    .update(releaseSchedules)
    .set({
      status: "failed",
      safeErrorMessage: input.safeErrorMessage,
      updatedAt: new Date(),
      attemptCount: sql`${releaseSchedules.attemptCount} + 1`,
    })
    .where(
      and(
        eq(releaseSchedules.id, input.scheduleId),
        eq(releaseSchedules.workspaceId, input.workspaceId),
      ),
    );
}
