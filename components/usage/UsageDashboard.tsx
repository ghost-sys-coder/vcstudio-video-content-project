import { AuditLogFilters } from "@/components/usage/AuditLogFilters";
import { AuditLogTable } from "@/components/usage/AuditLogTable";
import { BudgetProgress } from "@/components/usage/BudgetProgress";
import { BudgetSettingsForm } from "@/components/usage/BudgetSettingsForm";
import { MarketingUsageSection } from "@/components/usage/MarketingUsageSection";
import { OperationalLimitsForm } from "@/components/usage/OperationalLimitsForm";
import { UsageByOperationChart } from "@/components/usage/UsageByOperationChart";
import { UsageByProjectTable } from "@/components/usage/UsageByProjectTable";
import { UsageEventTable } from "@/components/usage/UsageEventTable";
import { UsageSummaryCards } from "@/components/usage/UsageSummaryCards";
import type { UsageDashboardView } from "@/lib/usage/usage-dashboard";
import { Badge } from "@/components/ui/badge";
import { CircleDollarSign } from "lucide-react";

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
  const { summary, settings, limitDefaults, ledger, audit, marketing } = view;

  return (
    <div className="app-page font-[family-name:var(--font-geist-sans,Arial,sans-serif)]">
      <header className="app-page-header items-center">
        <div className="app-heading max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">
            Workspace operations
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Usage &amp; budgets
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Track spend, control budgets and limits, and review the workspace
            audit trail.
          </p>
        </div>
        <Badge variant="outline" className="h-7 gap-2 bg-secondary/50 px-3">
          <CircleDollarSign aria-hidden="true" />
          Workspace totals in USD
        </Badge>
      </header>

      <UsageSummaryCards
        monthToDateCents={summary.monthToDateCents}
        dayToDateCents={summary.dayToDateCents}
        pendingReservedCents={summary.pendingReservedCents}
        totalReconciledCents={summary.totalReconciledCents}
      />

      <div className="app-grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <BudgetProgress
          dayToDateCents={summary.dayToDateCents}
          dailyBudgetCents={settings.dailyBudgetCents}
          monthToDateCents={summary.monthToDateCents}
          monthlyBudgetCents={settings.monthlyBudgetCents}
        />
        <UsageByOperationChart rows={summary.byOperation} />
      </div>

      <UsageByProjectTable rows={summary.byProject} />

      {marketing && <MarketingUsageSection view={marketing} />}

      <section className="app-section" aria-labelledby="usage-controls-title">
        <div className="app-heading">
          <h2
            id="usage-controls-title"
            className="text-xl font-semibold tracking-tight"
          >
            Spending controls
          </h2>
          <p className="text-sm text-muted-foreground">
            Set workspace budgets, confirmation thresholds and production
            limits.
          </p>
        </div>
        <div className="app-grid grid-cols-1 xl:grid-cols-2">
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
      </section>

      <UsageEventTable
        items={ledger.items}
        page={ledger.page}
        pageCount={ledger.pageCount}
        total={ledger.total}
        prevHref={ledgerNav.prevHref}
        nextHref={ledgerNav.nextHref}
      />

      <AuditLogTable
        filter={<AuditLogFilters action={audit.action} />}
        items={audit.items}
        page={audit.page}
        pageCount={audit.pageCount}
        total={audit.total}
        prevHref={auditNav.prevHref}
        nextHref={auditNav.nextHref}
      />
    </div>
  );
}
