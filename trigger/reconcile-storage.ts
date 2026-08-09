import { schedules } from "@trigger.dev/sdk";
import { runStorageReconciliation } from "@/lib/reconciliation/run-storage-reconciliation";
import { getStorageReconciliationEnvironment } from "@/lib/env/server";

export const reconcileStorageTask = schedules.task({
  id: "reconcile-storage-assets",
  cron: "17 * * * *",
  queue: { name: "media-processing", concurrencyLimit: 1 },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async () => {
    const environment = getStorageReconciliationEnvironment();
    return runStorageReconciliation({
      batchSize: environment.STORAGE_RECONCILIATION_BATCH_SIZE,
      dryRun: environment.STORAGE_RECONCILIATION_DRY_RUN,
    });
  },
});
