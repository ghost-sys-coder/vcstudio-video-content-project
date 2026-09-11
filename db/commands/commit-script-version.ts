import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { calculateScriptStatistics } from "@/lib/domain/script-statistics";
import { NARRATION_NORMALIZATION_POLICY_VERSION } from "@/lib/domain/narration-normalization";
import { SCRIPT_EVIDENCE_RECORD_VERSION } from "@/lib/editorial/version-evidence";

/**
 * The claims, verdicts and citations as they stand, aggregated for one project.
 *
 * Built in SQL and inside the approving statement on purpose. Reading the
 * review in the application and passing it back would leave a window in which a
 * reviewer changes a verdict between the read and the approval, and the frozen
 * record would then describe a review nobody made. Here the snapshot and the
 * approved version are the same statement: either both exist or neither does.
 */
const evidenceAggregate = sql`
  select
    jsonb_agg(
      jsonb_build_object(
        'claimId', c.id,
        'quotedText', c.quoted_text,
        'reviewState', c.review_state,
        'reviewNote', c.review_note,
        'reviewedByUserId', c.reviewed_by_user_id,
        'reviewedAt', c.reviewed_at,
        'citations', coalesce(cit.citations, '[]'::jsonb)
      ) order by c.created_at
    ) as claims,
    count(*) as claim_count,
    count(*) filter (where c.review_state = 'supported') as supported_count,
    count(*) filter (where c.review_state = 'disputed') as disputed_count,
    count(*) filter (where c.review_state = 'unchecked') as unchecked_count
  from script_claims c
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'sourceId', s.id,
        'stance', cs.stance,
        'title', s.title,
        'url', s.url,
        'host', s.host,
        'excerpt', cs.excerpt
      ) order by cs.created_at
    ) as citations
    from script_claim_sources cs
    join project_sources s
      on s.id = cs.source_id and s.workspace_id = cs.workspace_id
    where cs.claim_id = c.id and cs.workspace_id = c.workspace_id
  ) cit on true
  where c.workspace_id = i.workspace_id and c.project_id = i.project_id
`;

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
      returning id, workspace_id, project_id, source_draft_revision as revision
    ), evidence as (
      insert into script_version_evidence (workspace_id, project_id, script_version_id, evidence,
        claim_count, supported_count, disputed_count, unchecked_count, signed_off_by_user_id, signed_off_at)
      select i.workspace_id, i.project_id, i.id,
        jsonb_build_object(
          'recordVersion', ${SCRIPT_EVIDENCE_RECORD_VERSION}::text,
          'normalizationPolicyVersion', ${NARRATION_NORMALIZATION_POLICY_VERSION}::text,
          'claims', coalesce(a.claims, '[]'::jsonb)
        ),
        coalesce(a.claim_count, 0), coalesce(a.supported_count, 0),
        coalesce(a.disputed_count, 0), coalesce(a.unchecked_count, 0),
        signoff.signed_by_user_id, signoff.signed_at
      from inserted i
      left join lateral (${evidenceAggregate}) a on true
      left join script_editorial_signoffs signoff
        on signoff.workspace_id = i.workspace_id and signoff.project_id = i.project_id
      where ${input.approve}
      returning id
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
