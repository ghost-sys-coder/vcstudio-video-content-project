import { AuditLogFilters } from "@/components/usage/AuditLogFilters";
import { AuditLogTable } from "@/components/usage/AuditLogTable";
import { BudgetProgress } from "@/components/usage/BudgetProgress";
import { BudgetSettingsForm } from "@/components/usage/BudgetSettingsForm";
import { OperationalLimitsForm } from "@/components/usage/OperationalLimitsForm";
import { UsageByOperationChart } from "@/components/usage/UsageByOperationChart";
import { UsageByProjectTable } from "@/components/usage/UsageByProjectTable";
import { UsageEventTable } from "@/components/usage/UsageEventTable";
import { UsageSummaryCards } from "@/components/usage/UsageSummaryCards";
import type { UsageDashboardView } from "@/lib/usage/usage-dashboard";

export function UsageDashboard({
  workspaceId,
  view,
  ledgerNav,
  auditNav,
}: {
  workspaceId: string;
  view: UsageDashboardView;
  ledgerNav: { prevHref: string | null; nextHref: string | null };
  auditNav: { prevHref: string | null; nextHref: string | null };
}) {
  const { summary, settings, limitDefaults, ledger, audit } = view;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Workspace
        </p>
        <h1 className="text-2xl font-semibold">Usage &amp; budgets</h1>
        <p className="text-sm text-muted-foreground">
          Track spend, control budgets and limits, and review the workspace
          audit trail.
        </p>
      </header>

      <UsageSummaryCards
        monthToDateCents={summary.monthToDateCents}
        dayToDateCents={summary.dayToDateCents}
        pendingReservedCents={summary.pendingReservedCents}
        totalReconciledCents={summary.totalReconciledCents}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetProgress
          dayToDateCents={summary.dayToDateCents}
          dailyBudgetCents={settings.dailyBudgetCents}
          monthToDateCents={summary.monthToDateCents}
          monthlyBudgetCents={settings.monthlyBudgetCents}
        />
        <UsageByOperationChart rows={summary.byOperation} />
      </div>

      <UsageByProjectTable rows={summary.byProject} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetSettingsForm
          workspaceId={workspaceId}
          dailyBudgetCents={settings.dailyBudgetCents}
          monthlyBudgetCents={settings.monthlyBudgetCents}
          manualConfirmationThresholdCents={
            settings.manualConfirmationThresholdCents
          }
        />
        <OperationalLimitsForm
          workspaceId={workspaceId}
          maxImagesPerBatch={settings.maxImagesPerBatch}
          maxScenesPerAudioBatch={settings.maxScenesPerAudioBatch}
          maxRenderDurationSeconds={settings.maxRenderDurationSeconds}
          defaults={{
            maxImagesPerBatch: limitDefaults.maxImagesPerBatch,
            maxScenesPerAudioBatch: limitDefaults.maxScenesPerAudioBatch,
            maxRenderDurationSeconds: limitDefaults.maxRenderDurationSeconds,
          }}
        />
      </div>

      <UsageEventTable
        items={ledger.items}
        page={ledger.page}
        pageCount={ledger.pageCount}
        total={ledger.total}
        prevHref={ledgerNav.prevHref}
        nextHref={ledgerNav.nextHref}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Audit trail</h2>
          <AuditLogFilters action={audit.action} />
        </div>
        <AuditLogTable
          items={audit.items}
          page={audit.page}
          pageCount={audit.pageCount}
          total={audit.total}
          prevHref={auditNav.prevHref}
          nextHref={auditNav.nextHref}
        />
      </div>
    </div>
  );
}
