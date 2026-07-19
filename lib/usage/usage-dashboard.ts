import "server-only";

import {
  getWorkspaceUsageSummary,
  type UsageSummary,
} from "@/db/repositories/usage-summary.repository";
import { listUsageLedgerEntries } from "@/db/repositories/usage-ledger.repository";
import {
  listAuditLogEvents,
  type AuditLogEntry,
} from "@/db/repositories/audit-log.repository";
import {
  getOperationalLimitEnvDefaults,
  loadCurrentBudgetSettingsInput,
} from "@/lib/budgets/current-settings";
import type { BudgetSettingsInput } from "@/lib/budgets/budget-settings";
import type { AuditAction } from "@/lib/audit/audit-actions";
import type { UsageLedgerEntry } from "@/lib/usage/usage-ledger";

export const USAGE_LEDGER_PAGE_SIZE = 20;
export const USAGE_AUDIT_PAGE_SIZE = 20;

export type UsageDashboardView = {
  summary: UsageSummary;
  settings: BudgetSettingsInput;
  limitDefaults: ReturnType<typeof getOperationalLimitEnvDefaults>;
  ledger: {
    items: UsageLedgerEntry[];
    page: number;
    pageCount: number;
    total: number;
  };
  audit: {
    items: AuditLogEntry[];
    page: number;
    pageCount: number;
    total: number;
    action: AuditAction | null;
  };
};

/**
 * Assembles everything the usage dashboard renders: spend rollups, the current
 * editable settings (to prefill the budget/limits forms and drive budget
 * progress), the environment limit defaults (form placeholders), and the first
 * requested page of the ledger and audit log. All reads are workspace-scoped and
 * bounded.
 */
export async function loadUsageDashboard(input: {
  workspaceId: string;
  ledgerPage?: number;
  auditPage?: number;
  auditAction?: AuditAction | null;
  now?: Date;
}): Promise<UsageDashboardView> {
  const ledgerPage = Math.max(1, Math.trunc(input.ledgerPage ?? 1));
  const auditPage = Math.max(1, Math.trunc(input.auditPage ?? 1));
  const auditAction = input.auditAction ?? null;

  const [summary, settings, ledger, audit] = await Promise.all([
    getWorkspaceUsageSummary({
      workspaceId: input.workspaceId,
      now: input.now,
    }),
    loadCurrentBudgetSettingsInput({ workspaceId: input.workspaceId }),
    listUsageLedgerEntries({
      workspaceId: input.workspaceId,
      page: ledgerPage,
      pageSize: USAGE_LEDGER_PAGE_SIZE,
    }),
    listAuditLogEvents({
      workspaceId: input.workspaceId,
      page: auditPage,
      pageSize: USAGE_AUDIT_PAGE_SIZE,
      action: auditAction,
    }),
  ]);

  return {
    summary,
    settings,
    limitDefaults: getOperationalLimitEnvDefaults(),
    ledger: {
      items: ledger.items,
      page: ledger.page,
      pageCount: ledger.pageCount,
      total: ledger.total,
    },
    audit: {
      items: audit.items,
      page: audit.page,
      pageCount: audit.pageCount,
      total: audit.total,
      action: auditAction,
    },
  };
}
