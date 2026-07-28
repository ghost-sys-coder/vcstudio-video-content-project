import "server-only";

import type { Project } from "@/db/schema";
import { deleteProject } from "@/db/commands/delete-project.command";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { cancelProjectTriggerRuns } from "@/lib/projects/cancel-project-trigger-runs";
import { deleteProjectAssetObjects } from "@/lib/storage/project-asset-storage";

export class ProjectDeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectDeletionError";
  }
}

/**
 * Permanently deletes a project: its stored assets, then its database rows.
 *
 * **Storage is purged before the database rows, deliberately.** Both orderings
 * can fail partway, so the question is which failure is recoverable:
 *
 * - Purge first: a storage failure leaves the project fully intact, and the
 *   user simply retries. If the purge succeeds but the row delete fails, the
 *   project is still listed (with broken assets) and a retry finishes the job —
 *   the purge is idempotent, so re-running it costs nothing.
 * - Rows first: a storage failure strands every object under a prefix whose
 *   owning rows no longer exist. Nothing in the app can find them again, and
 *   they bill forever.
 *
 * The second failure is invisible and permanent, so it is the one worth
 * designing out — which is the whole point of deleting a project.
 */
export async function deleteProjectPermanently(input: {
  workspaceId: string;
  project: Project;
  actorUserId: string;
}): Promise<{ deletedObjectCount: number; cancelledRunCount: number }> {
  // First, stop anything still running: an in-flight render would otherwise
  // upload its output after the purge and immediately re-orphan storage.
  const { cancelledCount } = await cancelProjectTriggerRuns({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });

  const { deletedCount } = await deleteProjectAssetObjects({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });

  const { deleted } = await deleteProject({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });
  if (!deleted)
    throw new ProjectDeletionError(
      "The project's files were removed but the project record could not be deleted. Try deleting it again.",
    );

  // The audit row survives the project (`audit_log_events.project_id` has no
  // foreign key), so the name is recorded here — otherwise the history entry
  // would be an unresolvable UUID.
  await recordAuditEvent({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    projectId: input.project.id,
    action: "project_deleted",
    targetType: "project",
    targetId: input.project.id,
    metadata: {
      projectName: input.project.name,
      deletedObjectCount: deletedCount,
      cancelledRunCount: cancelledCount,
    },
  });

  return {
    deletedObjectCount: deletedCount,
    cancelledRunCount: cancelledCount,
  };
}
