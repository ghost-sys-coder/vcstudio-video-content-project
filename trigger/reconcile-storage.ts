import { schedules } from "@trigger.dev/sdk";
import { runStorageReconciliation } from "@/lib/reconciliation/run-storage-reconciliation";
import { getStorageReconciliationEnvironment } from "@/lib/env/server";
import { dispatchPendingMediaInspections } from "@/lib/media/dispatch-pending-media-inspections";

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
    const [storage, inspections] = await Promise.all([
      runStorageReconciliation({
        batchSize: environment.STORAGE_RECONCILIATION_BATCH_SIZE,
        dryRun: environment.STORAGE_RECONCILIATION_DRY_RUN,
        abandonedUploadHours:
          environment.STORAGE_RECONCILIATION_ABANDONED_UPLOAD_HOURS,
      }),
      dispatchPendingMediaInspections(25),
    ]);
    return { storage, inspections };
  },
});
