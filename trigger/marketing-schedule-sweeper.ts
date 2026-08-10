import { logger, schedules, tasks } from "@trigger.dev/sdk";
import {
  advanceMarketingScheduleRule,
  claimDueMarketingScheduleRuns,
  failMarketingScheduleRun,
  markMarketingScheduleRunRunning,
} from "@/db/commands/marketing-schedule-commands";
import { getMarketingEnvironment } from "@/lib/env/server";
import type { marketingScheduleGenerationTask } from "@/trigger/marketing-schedule-generation";
import { runPublicationPerformanceSync } from "@/trigger/publication-performance-sync";

export const marketingScheduleSweeperTask = schedules.task({
  id: "marketing-schedule-sweeper",
  cron: "* * * * *",
  maxDuration: 300,
  run: async () => {
    const now = new Date();
    // Reuse this existing schedule because the Trigger.dev project is capped at
    // ten schedules. Due-state still enforces a six-hour provider interval; the
    // quarter-hour guard only provides timely catch-up after worker downtime.
    const performance =
      now.getUTCMinutes() % 15 === 0
        ? await runPublicationPerformanceSync().catch(() => {
            logger.error("Publication performance sweep failed.");
            return null;
          })
        : null;
    if (!getMarketingEnvironment().ENABLE_MARKETING_STUDIO)
      return { claimed: 0, dispatched: 0, performance };
    const claimed = await claimDueMarketingScheduleRuns({ now, limit: 25 });
    let dispatched = 0;
    for (const run of claimed) {
      await advanceMarketingScheduleRule({ ...run, now });
      try {
        const handle = await tasks.trigger<
          typeof marketingScheduleGenerationTask
        >(
          "marketing-schedule-generation",
          { workspaceId: run.workspaceId, scheduleRunId: run.id },
          { idempotencyKey: `marketing-schedule-run:${run.id}` },
        );
        await markMarketingScheduleRunRunning({
          workspaceId: run.workspaceId,
          scheduleRunId: run.id,
          triggerRunId: handle.id,
        });
        dispatched += 1;
      } catch {
        await failMarketingScheduleRun({
          workspaceId: run.workspaceId,
          scheduleRunId: run.id,
          ruleId: run.ruleId,
          category: "dispatch_failed",
          message: "This scheduled run could not be queued.",
        });
      }
    }
    return { claimed: claimed.length, dispatched, performance };
  },
});
