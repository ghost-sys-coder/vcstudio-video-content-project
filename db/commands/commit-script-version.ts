import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { calculateScriptStatistics } from "@/lib/domain/script-statistics";

/** The draft claim, optional approval swap and immutable snapshot succeed together. */
export async function commitScriptVersion(input: {
  workspaceId: string;
  projectId: string;
  userId: string;
  revision: number;
  content: string;
  approve: boolean;
  restoredFromVersionId?: string;
}) {
  const statistics = calculateScriptStatistics(input.content);
  const id = crypto.randomUUID();
  const result = await getDatabase().execute<{
    id: string;
    revision: number;
  }>(sql`
    with claimed as (
      update project_script_drafts set content = ${input.content}, revision = revision + 1,
        character_count = ${statistics.characterCount},
        estimated_narration_duration_seconds = ${statistics.estimatedNarrationDurationSeconds},
        updated_by_user_id = ${input.userId}::uuid, updated_at = now()
      where workspace_id = ${input.workspaceId}::uuid and project_id = ${input.projectId}::uuid
        and revision = ${input.revision}
        and exists (select 1 from projects where id = ${input.projectId}::uuid and workspace_id = ${input.workspaceId}::uuid and status <> 'archived')
        and (${input.restoredFromVersionId ?? null}::uuid is null or exists (
          select 1 from project_script_versions where id = ${input.restoredFromVersionId ?? null}::uuid
            and workspace_id = ${input.workspaceId}::uuid and project_id = ${input.projectId}::uuid and deleted_at is null
        ))
      returning *
    ), superseded as (
      update project_script_versions set status = 'superseded', approved_at = null, approved_by_user_id = null
      where workspace_id = ${input.workspaceId}::uuid and project_id = ${input.projectId}::uuid
        and status = 'approved' and ${input.approve} and exists (select 1 from claimed)
      returning id
    ), inserted as (
      insert into project_script_versions (id, workspace_id, project_id, version_number, source_draft_revision,
        content, character_count, estimated_narration_duration_seconds, created_by_user_id,
        restored_from_version_id, status, approved_by_user_id, approved_at)
      select ${id}::uuid, c.workspace_id, c.project_id,
        (select coalesce(max(version_number), 0) + 1 from project_script_versions where workspace_id = c.workspace_id and project_id = c.project_id),
        c.revision, c.content, c.character_count, c.estimated_narration_duration_seconds, ${input.userId}::uuid,
        ${input.restoredFromVersionId ?? null}::uuid,
        ${input.approve ? "approved" : "draft"}::script_version_status,
        ${input.approve ? input.userId : null}::uuid, case when ${input.approve} then now() else null end
      from claimed c cross join (select count(*) from superseded) dependency
      returning id, source_draft_revision as revision
    ) select id, revision from inserted
  `);
  const committed = result.rows[0];
  if (committed) return committed;
  // A lost response can be retried without creating a second approved version.
  if (input.approve) {
    const previous = await getDatabase().execute<{
      id: string;
      revision: number;
    }>(sql`
      select id, source_draft_revision as revision from project_script_versions
      where workspace_id = ${input.workspaceId}::uuid and project_id = ${input.projectId}::uuid
        and source_draft_revision = ${input.revision + 1} and content = ${input.content}
        and status = 'approved' and deleted_at is null limit 1
    `);
    if (previous.rows[0]) return previous.rows[0];
  }
  throw new Error("SCRIPT_REVISION_CONFLICT");
}
