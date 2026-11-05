import "server-only";
import { listExpiredVideoReservations } from "@/db/repositories/video-generations.repository";
import {
  updateVideoGeneration,
  settleVideoGeneration,
} from "@/db/commands/video-generation-commands";
/** Invoked by the existing 30-minute recovery pass; never starts provider work. */
export async function recoverVideoOperations() {
  let recovered = 0;
  for (const job of await listExpiredVideoReservations()) {
    const scope = { workspaceId: job.workspaceId, generationId: job.id };
    if (job.status === "queued" && job.attemptCount === 0) {
      const cancelled = await updateVideoGeneration({
        ...scope,
        from: ["queued"],
        values: {
          status: "cancelled",
          completedAt: new Date(),
          safeErrorMessage:
            "The queued request expired before provider submission. Its reservation was released.",
        },
      });
      if (cancelled) {
        await settleVideoGeneration({ ...scope, actualCostCents: 0 });
        recovered++;
      }
    } else if (job.status === "succeeded" && job.actualCostCents !== null) {
      await settleVideoGeneration({
        ...scope,
        actualCostCents: job.actualCostCents,
      });
      recovered++;
    } else if (
      ["cancelled", "failed"].includes(job.status) &&
      job.attemptCount === 0
    ) {
      await settleVideoGeneration({ ...scope, actualCostCents: 0 });
      recovered++;
    } else if (["submitting", "running", "inspecting"].includes(job.status)) {
      await updateVideoGeneration({
        ...scope,
        from: ["submitting", "running", "inspecting"],
        values: {
          status: "requires_reconciliation",
          encryptedOutput: null,
          errorCode: "worker_stopped",
          safeErrorMessage:
            "The worker stopped before completion. Resume this existing job when a provider handle is available. Funds remain reserved to prevent double spending.",
        },
      });
      recovered++;
    }
  }
  return { recovered };
}
