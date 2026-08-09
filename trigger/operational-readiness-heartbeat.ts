import { schedules } from "@trigger.dev/sdk";
import { upsertTaskHeartbeat } from "@/db/repositories/readiness.repository";

const TASK_ID = "operational-readiness-heartbeat";

export const operationalReadinessHeartbeatTask = schedules.task({
  id: TASK_ID,
  cron: "*/5 * * * *",
  queue: { name: "media-processing", concurrencyLimit: 1 },
  maxDuration: 60,
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async () => {
    const startedAt = new Date();
    const environment = process.env.READINESS_ENVIRONMENT ?? "development";
    await upsertTaskHeartbeat({
      taskId: TASK_ID,
      environment,
      startedAt,
      completedAt: null,
      outcome: "running",
      safeMessage: null,
    });
    await upsertTaskHeartbeat({
      taskId: TASK_ID,
      environment,
      startedAt,
      completedAt: new Date(),
      outcome: "succeeded",
      safeMessage: null,
    });
    return { outcome: "succeeded" as const };
  },
});
