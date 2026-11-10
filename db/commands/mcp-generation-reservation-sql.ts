import { sql } from "drizzle-orm";
export type McpGenerationReservationInput = {
  workspaceId: string;
  operationId: string;
  estimatedCostCents: number;
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  maximumCostCents: number;
};
/** Execute after the workspace advisory lock in a READ COMMITTED transaction. */
export function buildMcpGenerationReservationSql(
  p: McpGenerationReservationInput,
) {
  return sql`with totals as materialized (
    select coalesce(sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) filter(where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),0) daily,
    coalesce(sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) filter(where created_at >= date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'),0) monthly
    from usage_reservations where workspace_id=${p.workspaceId}::uuid and status in ('pending','reconciled')
  ), inserted as (
    insert into usage_reservations(workspace_id,operation_type,media_generation_operation_id,reserved_cost_cents,expires_at)
    select ${p.workspaceId}::uuid,'media_generation',o.id,${p.estimatedCostCents},o.expires_at from mcp_operations o cross join totals t
    where o.id=${p.operationId}::uuid and o.workspace_id=${p.workspaceId}::uuid and o.kind='generate_media' and o.status='approved' and o.expires_at>now()
      and ${p.estimatedCostCents}>0 and ${p.estimatedCostCents}<=${p.maximumCostCents} and t.daily+${p.estimatedCostCents}<=${p.dailyBudgetCents} and t.monthly+${p.estimatedCostCents}<=${p.monthlyBudgetCents}
      and (select count(*) from usage_reservations where workspace_id=${p.workspaceId}::uuid and operation_type::text='media_generation' and status='pending')<4
      and not exists(select 1 from usage_reservations where media_generation_operation_id=o.id)
    on conflict do nothing returning *
  ), event as (
    insert into usage_events(workspace_id,reservation_id,operation_type,event_type,estimated_cost_cents,safe_metadata)
    select workspace_id,id,'media_generation','reserved',reserved_cost_cents,jsonb_build_object('operationId',${p.operationId}::text) from inserted on conflict(reservation_id,event_type) do nothing returning id
  ) select coalesce((select id from inserted),(select id from usage_reservations where workspace_id=${p.workspaceId}::uuid and media_generation_operation_id=${p.operationId}::uuid and status='pending')) id, (select count(*) from event) events`;
}
