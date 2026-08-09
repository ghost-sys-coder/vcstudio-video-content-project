import { schedules } from "@trigger.dev/sdk";
import { listMarketingEnabledWorkspaceIds } from "@/db/repositories/marketing-settings.repository";
import { generateMarketingWeeklyDigest } from "@/db/repositories/marketing-weekly-digests.repository";
import { getMarketingEnvironment } from "@/lib/env/server";
import { getUtcWeekRange } from "@/lib/marketing/digests/weekly-digest";

export const marketingWeeklyDigestTask = schedules.task({
  id: "marketing-weekly-digest",
  cron: "0 6 * * 1",
  queue: { name: "marketing-digest", concurrencyLimit: 1 },
  maxDuration: 600,
  run: async (_, { ctx }) => {
    if (!getMarketingEnvironment().ENABLE_MARKETING_STUDIO)
      return { checked: 0, generated: 0, failed: 0 };
    const current = getUtcWeekRange(new Date());
    const weekStart = new Date(current.start.getTime() - 7 * 86_400_000);
    const weekEnd = current.start;
    const workspaces = await listMarketingEnabledWorkspaceIds();
    let generated = 0;
    let failed = 0;
    for (const workspace of workspaces.slice(0, 500)) {
      try {
        await generateMarketingWeeklyDigest({
          workspaceId: workspace.workspaceId,
          weekStart,
          weekEnd,
          triggerRunId: ctx.run.id,
        });
        generated += 1;
      } catch {
        failed += 1;
      }
    }
    return { checked: workspaces.length, generated, failed };
  },
});
