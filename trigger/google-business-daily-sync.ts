import { schedules } from "@trigger.dev/sdk";
import { listActiveGoogleBusinessConnections } from "@/db/repositories/google-business.repository";
import { syncGoogleBusiness } from "@/lib/marketing/integrations/sync-google-business";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";

export const googleBusinessDailySyncTask = schedules.task({
  id: "google-business-daily-sync",
  cron: "0 3 * * *",
  queue: { name: "google-business-sync", concurrencyLimit: 1 },
  maxDuration: 300,
  run: async () => {
    const connections = await listActiveGoogleBusinessConnections();
    let succeeded = 0;
    let failed = 0;
    for (const connection of connections) {
      try {
        const result = await syncGoogleBusiness({
          workspaceId: connection.workspaceId,
        });
        await recordAuditEvent({
          workspaceId: connection.workspaceId,
          action: "google_business_synced",
          targetType: "google_business_connection",
          targetId: connection.id,
          metadata: { locations: result.locations, source: "daily_sync" },
        });
        succeeded += 1;
      } catch {
        failed += 1;
      }
    }
    return { checked: connections.length, succeeded, failed };
  },
});
