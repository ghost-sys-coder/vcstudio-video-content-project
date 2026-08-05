import { MarketingScheduleRuleCard } from "@/components/marketing/MarketingScheduleRuleCard";
import { MarketingScheduleRuleForm } from "@/components/marketing/MarketingScheduleRuleForm";
import { MarketingScheduleRunList } from "@/components/marketing/MarketingScheduleRunList";
import { listMarketingCampaigns } from "@/db/repositories/marketing-campaigns.repository";
import {
  listMarketingScheduleRuleRuns,
  listMarketingScheduleRules,
} from "@/db/repositories/marketing-schedules.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMarketingSettings } from "@/lib/marketing/marketing-settings-view";
import { can } from "@/lib/policies/workspace-policy";

export default async function MarketingSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const workspaceId = context.activeMembership.workspaceId;
  const [rules, runs, campaigns, settings, query] = await Promise.all([
    listMarketingScheduleRules({ workspaceId }),
    listMarketingScheduleRuleRuns({ workspaceId }),
    listMarketingCampaigns({ workspaceId }),
    loadMarketingSettings({ workspaceId }),
    searchParams,
  ]);
  const editing = rules.find((rule) => rule.id === query.edit);
  const canManage = can(
    context.activeMembership.role,
    "manageMarketingSchedules",
  );
  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Recurring schedules</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Generate current, research-aware drafts on a cadence. Rules stop
          claiming immediately in Manual mode, respect daily and per-rule caps,
          and never approve their own work.
        </p>
      </header>
      {settings.autonomyLevel === "manual" ? (
        <p className="rounded-xl border border-notice-warning-edge bg-notice-warning p-4 text-sm text-notice-warning-foreground">
          Autonomy is Manual. Rules can be prepared here, but the sweeper will
          not claim them until an owner selects Assisted in Studio settings.
        </p>
      ) : null}
      {canManage ? (
        <section className="space-y-3">
          <h2 className="font-medium">
            {editing ? `Edit ${editing.name}` : "New recurring rule"}
          </h2>
          <MarketingScheduleRuleForm
            campaigns={campaigns.map(({ id, name }) => ({ id, name }))}
            defaultTimezone={settings.defaultTimezone}
            rule={editing}
          />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only a workspace owner can create or change rules that spend on a
          timer.
        </p>
      )}
      <section className="space-y-3">
        <h2 className="font-medium">Rules</h2>
        {rules.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {rules.map((rule) => (
              <MarketingScheduleRuleCard key={rule.id} rule={rule} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No recurring rules yet.
          </p>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-medium">Recent runs</h2>
        <MarketingScheduleRunList runs={runs} />
      </section>
    </div>
  );
}
