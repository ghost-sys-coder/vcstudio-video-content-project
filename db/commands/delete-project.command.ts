import "server-only";

import { and, eq } from "drizzle-orm";
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

  const [, , , , , , , , , deletedProjects] = await database.batch([
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
