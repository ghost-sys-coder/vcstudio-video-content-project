import "server-only";
import { z } from "zod";
import {
  listMcpGenerationRecoveryOperations,
  listMcpGenerationJobs,
} from "@/db/repositories/mcp-generation.repository";
import { settleMcpGeneration } from "@/db/commands/mcp-generation-commands";
import { updateMcpOperation } from "@/db/repositories/mcp.repository";
import { authorizeMcpBrowser } from "./context";
import {
  dispatchMcpGeneration,
  getMcpGenerationStatus,
} from "./generation-service";
const resultSchema = z.object({
  providerSubmitted: z.boolean().default(false),
  actualCostCents: z.number().int().nonnegative().optional(),
});
/** Extends the existing half-hour recovery only. Never retries a billable attempt. */
export async function recoverMcpGenerations() {
  let recovered = 0;
  for (const row of await listMcpGenerationRecoveryOperations()) {
    const op = row.operation;
    try {
      const result = resultSchema.parse(op.result ?? {});
      if (
        !row.reservationStatus &&
        ["approved", "running"].includes(op.status)
      ) {
        const job = (await listMcpGenerationJobs(op.workspaceId, op.id))[0];
        if (job && ["succeeded", "failed", "cancelled"].includes(job.status)) {
          await updateMcpOperation({
            workspaceId: op.workspaceId,
            operationId: op.id,
            from: [op.status],
            expectedUpdatedAt: op.updatedAt,
            values: {
              status: job.status === "succeeded" ? "succeeded" : "failed",
              error: job.error,
              result: {
                generationId: job.id,
                sceneId: job.sceneId,
                projectId: job.projectId,
                actualCostCents: job.actualCostCents,
                href: `/app/projects/${job.projectId}/scenes?sceneId=${job.sceneId}`,
              },
            },
          });
          recovered++;
          continue;
        }
      }
      // A queued task can start just before quote expiry. Let an active worker
      // finish; its own maximum duration is five minutes, far below this window.
      if (
        op.status === "running" &&
        Date.now() - op.updatedAt.getTime() < 30 * 60_000
      )
        continue;
      if (op.status === "succeeded") {
        if (row.reservationStatus === "pending")
          await settleMcpGeneration(
            op.workspaceId,
            op.id,
            result.actualCostCents ?? row.reservedCostCents ?? 0,
          );
      } else if (
        ["failed", "cancelled", "expired"].includes(op.status) ||
        op.expiresAt <= new Date() ||
        (op.status === "running" && row.reservationStatus === "pending")
      ) {
        const terminal = ["failed", "cancelled", "expired"].includes(op.status)
          ? op
          : await updateMcpOperation({
              workspaceId: op.workspaceId,
              operationId: op.id,
              from: [op.status],
              expectedUpdatedAt: op.updatedAt,
              values: {
                status: "failed",
                error: result.providerSubmitted
                  ? "The generation worker stopped after provider submission. Its estimated or recorded cost was retained; no paid retry was made. Inspect Usage & budgets before starting another generation."
                  : "This generation expired or its authorization was cancelled before it completed. No new provider call was made.",
              },
            });
        if (terminal && row.reservationStatus === "pending")
          await settleMcpGeneration(
            op.workspaceId,
            op.id,
            result.providerSubmitted
              ? (result.actualCostCents ?? row.reservedCostCents ?? 0)
              : 0,
          );
      } else if (op.status === "approved" || op.status === "queued")
        await dispatchMcpGeneration(op);
      else {
        const context = await authorizeMcpBrowser(
          op.userId,
          op.connectionId,
          op.workspaceId,
          "vcstudio:generate",
        );
        await getMcpGenerationStatus(context, op.id);
      }
      recovered++;
    } catch {
      // A failed status/authority read is not evidence that a provider did not
      // bill. Keep funds reserved and never overwrite a newer worker revision.
      console.error("MCP generation recovery deferred", { operationId: op.id });
      await updateMcpOperation({
        workspaceId: op.workspaceId,
        operationId: op.id,
        from: [op.status],
        expectedUpdatedAt: op.updatedAt,
        values: {
          error:
            "Generation recovery could not inspect this request. Funds remain reserved while its outcome is checked. Inspect this same operation again; do not start a duplicate generation.",
        },
      });
    }
  }
  return recovered;
}
