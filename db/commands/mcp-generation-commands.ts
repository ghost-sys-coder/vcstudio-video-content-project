import "server-only";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDatabase, getNeonClient } from "@/db/drizzle";
import { McpError } from "@/lib/mcp/errors";
import {
  buildMcpGenerationReservationSql,
  type McpGenerationReservationInput,
} from "./mcp-generation-reservation-sql";

export async function reserveMcpGeneration(
  input: McpGenerationReservationInput,
) {
  const client = getNeonClient();
  const compiled = new PgDialect().sqlToQuery(
    buildMcpGenerationReservationSql(input),
  );
  const rows = await client.transaction(
    [
      client`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId},0))`,
      client.query(compiled.sql, compiled.params),
    ],
    { isolationLevel: "ReadCommitted" },
  );
  const result = z
    .array(z.object({ id: z.uuid().nullable() }))
    .parse(rows[1])[0];
  if (!result?.id)
    throw new McpError(
      "budget_exceeded",
      "Generation could not reserve its cost. Check workspace budgets, active generations and the request's maximum cost.",
    );
  return result.id;
}
/** Exactly-once settlement, including conservative charges for an uncertain billable attempt. */
export async function settleMcpGeneration(
  workspaceId: string,
  operationId: string,
  actualCostCents: number,
) {
  if (!Number.isSafeInteger(actualCostCents) || actualCostCents < 0)
    throw new Error("INVALID_GENERATION_COST");
  await getDatabase().execute(sql`with settled as (
    update usage_reservations set status=${actualCostCents === 0 ? "released" : "reconciled"}::usage_reservation_status,actual_cost_cents=${actualCostCents},updated_at=now()
    where workspace_id=${workspaceId}::uuid and media_generation_operation_id=${operationId}::uuid and status='pending' returning *
  ) insert into usage_events(workspace_id,reservation_id,operation_type,event_type,estimated_cost_cents,actual_cost_cents,safe_metadata)
    select workspace_id,id,operation_type,${actualCostCents === 0 ? "released" : "reconciled"}::usage_event_type,reserved_cost_cents,${actualCostCents},jsonb_build_object('operationId',${operationId}::text) from settled on conflict(reservation_id,event_type) do nothing`);
}
