import { OperationalReadinessDashboard } from "@/components/readiness/OperationalReadinessDashboard";
import { UsageDashboard } from "@/components/usage/UsageDashboard";
import {
  readinessView,
  usageView,
  operationsWorkspaceId,
} from "./operations-data";

export function OperationsUiHarness() {
  const params = new URLSearchParams(location.search);
  const empty = params.get("state") === "empty";
  if (params.get("mode") === "readiness")
    return (
      <OperationalReadinessDashboard
        view={
          empty
            ? { ...readinessView, deployment: [], workspace: [] }
            : readinessView
        }
      />
    );
  const ledgerPage = Number(params.get("ledgerPage") ?? 1);
  const auditPage = Number(params.get("auditPage") ?? 1);
  const view = empty
    ? {
        ...usageView,
        summary: {
          ...usageView.summary,
          dayToDateCents: 0,
          monthToDateCents: 0,
          pendingReservedCents: 0,
          totalReconciledCents: 0,
          byOperation: [],
          byProject: [],
        },
        settings: {
          ...usageView.settings,
          dailyBudgetCents: 0,
          monthlyBudgetCents: 0,
        },
        ledger: { ...usageView.ledger, items: [], total: 0, pageCount: 1 },
        audit: { ...usageView.audit, items: [], total: 0, pageCount: 1 },
      }
    : {
        ...usageView,
        ledger: { ...usageView.ledger, page: ledgerPage },
        audit: { ...usageView.audit, page: auditPage },
      };
  return (
    <UsageDashboard
      workspaceId={operationsWorkspaceId}
      view={view}
      ledgerNav={{
        prevHref:
          ledgerPage > 1
            ? `/operations.html?mode=usage&ledgerPage=${ledgerPage - 1}`
            : null,
        nextHref:
          !empty && ledgerPage < 3
            ? `/operations.html?mode=usage&ledgerPage=${ledgerPage + 1}`
            : null,
      }}
      auditNav={{
        prevHref:
          auditPage > 1
            ? `/operations.html?mode=usage&auditPage=${auditPage - 1}`
            : null,
        nextHref:
          !empty && auditPage < 3
            ? `/operations.html?mode=usage&auditPage=${auditPage + 1}`
            : null,
      }}
    />
  );
}
