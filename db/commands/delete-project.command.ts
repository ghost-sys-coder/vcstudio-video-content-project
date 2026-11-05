import "server-only";

import { and, eq, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDatabase } from "@/db/drizzle";
import {
  projectOutputVariants,
  projects,
  sceneAnalysisRuns,
  sceneImageGenerations,
  sceneVariantFramings,
  scenes,
  shortClips,
  shortCompositions,
  videoPublications,
  videoRenders,
  videoGenerations,
  usageReservations,
  usageEvents,
} from "@/db/schema";

/**
 * Permanently deletes a project and everything under it.
 *
 * **The child deletes below are required, and their order matters.** A bare
 * `DELETE FROM projects` does not work despite every project-scoped table
 * cascading, because several of those cascaded children reference *each other*
 * with `ON DELETE RESTRICT`, and Postgres validates RESTRICT immediately rather
 * than deferring it to the end of the statement. Verified against real data:
 * the bare delete aborts on `scene_variant_framings_tenant_source_image_fkey`.
 *
 * This order is empirically verified to leave nothing behind — after it runs,
 * no row in any of the 26 project-scoped tables still references the project.
 * Tables not listed are removed by ordinary cascade once their parent goes.
 * `audit_log_events` is deliberately excluded: its `project_id` carries no
 * foreign key precisely so the audit trail outlives what it describes.
 *
 * Scoped by workspace as well as id, so a project identifier from the browser
 * can never reach another tenant's row. Sent as one batch, which the neon-http
 * driver executes as a single transaction: a half-deleted project would be
 * unusable and unrecoverable.
 *
 * Stored assets are NOT removed here — see
 * `lib/storage/project-asset-storage.ts`. The caller purges storage *first*, so
 * that a storage failure leaves the project intact and retryable rather than
 * stranding objects nobody can find.
 */
export async function deleteProject(input: {
  workspaceId: string;
  projectId: string;
}): Promise<{ deleted: boolean }> {
  const database = getDatabase();
  // Takes the two columns rather than the table: Drizzle types columns per
  // table, so a table-shaped parameter binds to whichever table is named first
  // and rejects the rest.
  const scoped = (projectId: PgColumn, workspaceId: PgColumn) =>
    and(eq(projectId, input.projectId), eq(workspaceId, input.workspaceId));

  const [, , , , , , , , , , , , , , deletedProjects] = await database.batch([
    // Separate lock and guard statements ensure the guard sees reservations
    // committed while waiting. Never delete provider accounting to reset credit.
    database
      .select({
        lock: sql`pg_advisory_xact_lock(hashtextextended(${input.workspaceId},0))`,
      })
      .from(projects)
      .where(scoped(projects.id, projects.workspaceId)),
    database
      .select({
        guard: sql`1 / case when exists(select 1 from usage_reservations where workspace_id=${input.workspaceId}::uuid and project_id=${input.projectId}::uuid and operation_type::text='video_generation' and status='pending') then 0 else 1 end`,
      })
      .from(projects)
      .where(scoped(projects.id, projects.workspaceId)),
    // Event project IDs are nullable first so their composite FK never dangles.
    database
      .update(usageEvents)
      .set({ projectId: null })
      .where(
        and(
          scoped(usageEvents.projectId, usageEvents.workspaceId),
          eq(usageEvents.operationType, "video_generation"),
        ),
      ),
    database
      .update(usageReservations)
      .set({ projectId: null })
      .where(
        and(
          scoped(usageReservations.projectId, usageReservations.workspaceId),
          eq(usageReservations.operationType, "video_generation"),
        ),
      ),
    database
      .update(videoGenerations)
      .set({
        projectId: null,
        sceneId: null,
        sceneVersionId: null,
        targetDetached: true,
      })
      .where(scoped(videoGenerations.projectId, videoGenerations.workspaceId)),
    // Framings pin a source image with RESTRICT — the constraint that makes a
    // bare cascade abort.
    database
      .delete(sceneVariantFramings)
      .where(
        scoped(
          sceneVariantFramings.projectId,
          sceneVariantFramings.workspaceId,
        ),
      ),
    database
      .delete(shortClips)
      .where(scoped(shortClips.projectId, shortClips.workspaceId)),
    // Publications hang off renders, so they clear the way for them.
    database
      .delete(videoPublications)
      .where(
        scoped(videoPublications.projectId, videoPublications.workspaceId),
      ),
    // Renders RESTRICT-reference both output variants and short compositions.
    database
      .delete(videoRenders)
      .where(scoped(videoRenders.projectId, videoRenders.workspaceId)),
    database
      .delete(shortCompositions)
      .where(
        scoped(shortCompositions.projectId, shortCompositions.workspaceId),
      ),
    database
      .delete(sceneImageGenerations)
      .where(
        scoped(
          sceneImageGenerations.projectId,
          sceneImageGenerations.workspaceId,
        ),
      ),
    database
      .delete(projectOutputVariants)
      .where(
        scoped(
          projectOutputVariants.projectId,
          projectOutputVariants.workspaceId,
        ),
      ),
    // Both RESTRICT-reference project_script_versions.
    database
      .delete(sceneAnalysisRuns)
      .where(
        scoped(sceneAnalysisRuns.projectId, sceneAnalysisRuns.workspaceId),
      ),
    database.delete(scenes).where(scoped(scenes.projectId, scenes.workspaceId)),
    database
      .delete(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.workspaceId, input.workspaceId),
        ),
      )
      .returning({ id: projects.id }),
  ]);

  return { deleted: deletedProjects.length > 0 };
}
