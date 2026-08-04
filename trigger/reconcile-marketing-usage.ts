import { logger, schedules } from "@trigger.dev/sdk";
import { releaseExpiredMarketingReservation } from "@/db/commands/marketing-usage-commands";
import { listExpiredMarketingReservations } from "@/db/repositories/marketing-usage.repository";

const RECONCILIATION_BATCH_SIZE = 100;

/**
 * Releases marketing reservations whose work never arrived.
 *
 * A pending reservation counts against the workspace's daily and monthly
 * budgets, so one that is never settled silently shrinks the allowance until the
 * window rolls over. Runs every five minutes, matching the scene-image
 * reconciler, and is safe to run concurrently with settlement: the release is
 * conditional on the row still being `pending` and already past its expiry.
 */
export const reconcileMarketingUsageTask = schedules.task({
  id: "reconcile-marketing-usage",
  cron: "*/5 * * * *",
  queue: { name: "ai-text", concurrencyLimit: 1 },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async () => {
    const now = new Date();
    const reservations = await listExpiredMarketingReservations({
      now,
      limit: RECONCILIATION_BATCH_SIZE,
    });
    let releasedCount = 0;
    let errorCount = 0;

    for (const reservation of reservations) {
      try {
        const released = await releaseExpiredMarketingReservation({
          reservationId: reservation.id,
          now,
        });
        if (released) releasedCount += 1;
      } catch {
        errorCount += 1;
        logger.error("Expired marketing reservation release failed.", {
          reservationId: reservation.id,
        });
      }
    }

    return {
      scannedCount: reservations.length,
      releasedCount,
      errorCount,
      truncated: reservations.length === RECONCILIATION_BATCH_SIZE,
    };
  },
});
