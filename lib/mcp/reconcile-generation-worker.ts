import "server-only";
import { runs } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  findMcpOperation,
  updateMcpOperation,
  type McpOperation,
} from "@/db/repositories/mcp.repository";
import { settleMcpGeneration } from "@/db/commands/mcp-generation-commands";
const state = z.object({
  providerSubmitted: z.boolean().default(false),
  actualCostCents: z.number().int().nonnegative().optional(),
});
const quote = z.object({ estimatedCostCents: z.number().int().nonnegative() });
const TERMINAL = new Set([
  "COMPLETED",
  "FAILED",
  "CRASHED",
  "CANCELED",
  "TIMED_OUT",
  "EXPIRED",
  "SYSTEM_FAILURE",
]);
export async function failStoppedMcpGeneration(
  workspaceId: string,
  operationId: string,
) {
  const op = await findMcpOperation({ workspaceId, operationId });
  if (
    !op ||
    op.kind !== "generate_media" ||
    !["queued", "running", "approved"].includes(op.status)
  )
    return op;
  const parsed = state.parse(op.result ?? {});
  const estimated = quote.parse(op.input.preview).estimatedCostCents;
  const failed = await updateMcpOperation({
    workspaceId,
    operationId,
    from: ["queued", "running", "approved"],
    values: {
      status: "failed",
      error: parsed.providerSubmitted
        ? "Generation stopped after provider submission. The recorded or estimated cost was retained. No automatic paid retry was made; inspect Usage & budgets before starting another request."
        : "The generation worker stopped before provider submission. Its reservation was released. Prepare a fresh request to try again.",
      result: {
        ...op.result,
        actualCostCents: parsed.providerSubmitted
          ? (parsed.actualCostCents ?? estimated)
          : 0,
      },
    },
  });
  if (failed)
    await settleMcpGeneration(
      workspaceId,
      operationId,
      parsed.providerSubmitted ? (parsed.actualCostCents ?? estimated) : 0,
    );
  return failed ?? op;
}
export async function reconcileMcpGenerationWorker(op: McpOperation) {
  if (
    !op.triggerRunId ||
    !["queued", "running"].includes(op.status) ||
    Date.now() - op.updatedAt.getTime() < 10_000
  )
    return op;
  const run = await runs.retrieve(op.triggerRunId);
  return TERMINAL.has(run.status)
    ? ((await failStoppedMcpGeneration(op.workspaceId, op.id)) ?? op)
    : op;
}
