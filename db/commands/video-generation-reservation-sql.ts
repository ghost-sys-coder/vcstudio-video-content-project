import { sql } from "drizzle-orm";
import type {
  VideoGenerationRequest,
  VideoModelDescriptor,
  VideoModelPricing,
} from "@studio/contracts/video";
import type { VideoGeneration } from "@/db/schema";

export type ReserveVideoInput = {
  id: string;
  reservationId: string;
  workspaceId: string;
  userId: string;
  quoteId: string;
  mcpOperationId?: string;
  idempotencyKey: string;
  fingerprint: string;
  request: VideoGenerationRequest;
  model: VideoModelDescriptor;
  pricing: VideoModelPricing;
  inputAssets: VideoGeneration["inputAssets"];
  finalPrompt: string;
  promptTemplateVersion: string;
  estimatedCostCents: number;
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  videoDailyBudgetCents: number;
  videoLifetimeBudgetCents: number;
  maximumCostCents: number;
};
/** Execute AFTER the separate advisory-lock statement in the same transaction.
 * READ COMMITTED then observes work committed while waiting for the lock. */
export function buildVideoReservationSql(input: ReserveVideoInput) {
  const target = input.request.target;
  const projectId = target.kind === "scene" ? target.projectId : null;
  const sceneId = target.kind === "scene" ? target.sceneId : null;
  const sceneVersionId = target.kind === "scene" ? target.sceneVersionId : null;
  return sql`
  with existing as materialized (
    select id, request_fingerprint, requested_by_user_id from video_generations where workspace_id=${input.workspaceId}::uuid and idempotency_key=${input.idempotencyKey}
  ), totals as materialized (
    select
      coalesce(sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) filter(where workspace_id=${input.workspaceId}::uuid and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),0) as daily,
      coalesce(sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) filter(where workspace_id=${input.workspaceId}::uuid and created_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),0) as monthly,
      coalesce(sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) filter(where workspace_id=${input.workspaceId}::uuid and project_id=${projectId}::uuid),0) as project,
      coalesce(sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) filter(where operation_type::text='video_generation'),0) as video_lifetime,
      coalesce(sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) filter(where operation_type::text='video_generation' and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),0) as video_daily
    from usage_reservations where status in ('pending','reconciled')
  ), eligibility as materialized (
    select case
      when exists(select 1 from video_generations where quote_id=${input.quoteId}::uuid) then 'quote_used'
      when ${input.estimatedCostCents}::int>${input.maximumCostCents}::int then 'operation_budget'
      when t.daily+${input.estimatedCostCents}>${input.dailyBudgetCents} then 'workspace_daily_budget'
      when t.monthly+${input.estimatedCostCents}>${input.monthlyBudgetCents} then 'workspace_monthly_budget'
      when t.video_daily+${input.estimatedCostCents}>${input.videoDailyBudgetCents} then 'video_daily_budget'
      when t.video_lifetime+${input.estimatedCostCents}>${input.videoLifetimeBudgetCents} then 'video_lifetime_budget'
      when (select count(*) from video_generations where status in ('queued','submitting','running','inspecting'))>=2 then 'concurrency_limit'
      when exists(select 1 from video_generations where workspace_id=${input.workspaceId}::uuid and request_fingerprint=${input.fingerprint} and status='requires_reconciliation') then 'unresolved_request'
      when ${projectId}::uuid is not null and not exists(
        select 1 from projects p join scenes s on s.project_id=p.id and s.workspace_id=p.workspace_id
        join scene_versions sv on sv.version_number=s.current_version and sv.scene_id=s.id and sv.project_id=p.id and sv.workspace_id=p.workspace_id
        where p.workspace_id=${input.workspaceId}::uuid and p.id=${projectId}::uuid and p.archived_at is null
        and s.id=${sceneId}::uuid and sv.id=${sceneVersionId}::uuid and sv.version_number=${target.kind === "scene" ? target.expectedSceneVersion : 0}
        and t.project+${input.estimatedCostCents}<=p.maximum_budget_cents
      ) then 'project_budget_or_revision'
      else 'allowed' end as reason from totals t
  ), inserted as (
    insert into video_generations(id,workspace_id,project_id,scene_id,scene_version_id,requested_by_user_id,quote_id,mcp_operation_id,idempotency_key,request_fingerprint,request,model_snapshot,pricing_snapshot,input_assets,final_prompt,prompt_template_version,estimated_cost_cents)
    select ${input.id}::uuid,${input.workspaceId}::uuid,${projectId}::uuid,${sceneId}::uuid,${sceneVersionId}::uuid,${input.userId}::uuid,${input.quoteId}::uuid,${input.mcpOperationId ?? null}::uuid,${input.idempotencyKey},${input.fingerprint},${JSON.stringify(input.request)}::jsonb,${JSON.stringify(input.model)}::jsonb,${JSON.stringify(input.pricing)}::jsonb,${JSON.stringify(input.inputAssets)}::jsonb,${input.finalPrompt},${input.promptTemplateVersion},${input.estimatedCostCents}
    from eligibility where reason='allowed' and not exists(select 1 from existing)
    returning id
  ), reservation as (
    insert into usage_reservations(id,workspace_id,project_id,operation_type,video_generation_id,reserved_cost_cents,expires_at)
    select ${input.reservationId}::uuid,${input.workspaceId}::uuid,${projectId}::uuid,'video_generation',id,${input.estimatedCostCents},now()+interval '2 hours' from inserted returning id
  ), event as (
    insert into usage_events(workspace_id,project_id,reservation_id,operation_type,event_type,estimated_cost_cents,safe_metadata)
    select ${input.workspaceId}::uuid,${projectId}::uuid,id,'video_generation','reserved',${input.estimatedCostCents},jsonb_build_object('videoGenerationId',${input.id}::text) from reservation returning id
  )
  select coalesce((select id::text from inserted),(select id::text from existing)) as id,
    case when exists(select 1 from existing) then
      case when (select request_fingerprint from existing)=${input.fingerprint} and (select requested_by_user_id from existing)=${input.userId}::uuid then 'existing' else 'idempotency_conflict' end
      else (select reason from eligibility) end as result,
    (select count(*)::int from event) as recorded_events
  `;
}
