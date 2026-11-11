import { logger, task, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  appendProductionRunEvent,
  claimProductionRunRunning,
  failStoppedProductionRun,
  holdProductionRun,
} from "@/db/commands/production-run-commands";
import { findProductionRun } from "@/db/repositories/production-runs.repository";
import { executeProductionStep } from "@/lib/production-runs/execute-production-step";
import { productionRunServices } from "@/lib/production-runs/production-run-services";

export const productionRunTaskPayloadSchema = z.object({
  workspaceId: z.uuid(),
  runId: z.uuid(),
});

/** How long one worker run will drive a production run before handing back. */
const MAX_WALL_CLOCK_SECONDS = 4 * 60 * 60;
/** Upper bound on back-to-back steps, so a planning defect cannot spin. */
const MAX_STEPS_PER_RUN = 400;

/**
 * Drives one production run from its current stage to a stop.
 *
 * **Why a loop over the planner rather than child tasks.** Every stage is
 * started through the same service a creator's click uses, which dispatches
 * its own worker and records its own rows. This task therefore owns nothing:
 * it reads PostgreSQL, decides one step, carries it out, and either continues
 * or waits. A replacement run after a crash reads the same rows and reaches
 * the same step, which is what `AGENTS.md` means by PostgreSQL being the
 * authoritative state.
 *
 * **Why `wait.for` rather than a schedule.** The free Trigger.dev tier counts
 * schedules; a run that polls its own stage work with checkpointed waits adds
 * no schedule and costs nothing while idle.
 */
export const productionRunTask = task({
  id: "production-run",
  queue: { name: "production-orchestration", concurrencyLimit: 2 },
  retry: { maxAttempts: 1 },
  maxDuration: MAX_WALL_CLOCK_SECONDS + 300,
  run: async (payload: unknown) => {
    const input = productionRunTaskPayloadSchema.parse(payload);
    const claimed = await claimProductionRunRunning(input);
    if (!claimed) {
      const current = await findProductionRun(input);
      logger.info("Production run not claimable", {
        runId: input.runId,
        status: current?.status ?? "missing",
      });
      return {
        outcome: "notClaimed" as const,
        status: current?.status ?? null,
      };
    }

    const deadline = Date.now() + MAX_WALL_CLOCK_SECONDS * 1000;
    for (let step = 0; step < MAX_STEPS_PER_RUN; step += 1) {
      if (Date.now() > deadline) break;
      const outcome = await executeProductionStep(productionRunServices, input);
      if (outcome.kind === "stopped")
        return { outcome: "stopped" as const, status: outcome.status };
      if (outcome.kind === "wait") {
        logger.info("Production run waiting", {
          runId: input.runId,
          reason: outcome.reason,
          seconds: outcome.seconds,
        });
        await wait.for({ seconds: outcome.seconds });
      }
    }

    // Out of time or steps. The state is all in the database, so a person can
    // resume rather than lose anything; the hold says why.
    const run = await findProductionRun(input);
    if (run?.status === "running") {
      const reason =
        "The run reached its time limit for one worker session. Resume to continue from where it stopped.";
      await holdProductionRun({ ...input, reason });
      await appendProductionRunEvent({
        ...input,
        stage: run.stage,
        kind: "held",
        message: reason,
      });
    }
    return { outcome: "timedOut" as const };
  },
  onFailure: async ({ payload, error }) => {
    const input = productionRunTaskPayloadSchema.parse(payload);
    const run = await findProductionRun(input);
    const failed = await failStoppedProductionRun({
      ...input,
      safeErrorMessage:
        "The run stopped unexpectedly. Nothing further was started; check the project and start a new run.",
    });
    if (failed && run)
      await appendProductionRunEvent({
        ...input,
        stage: run.stage,
        kind: "failed",
        message: "The worker stopped unexpectedly.",
        metadata: {
          error: error instanceof Error ? error.name : "unknown",
        },
      });
  },
});
