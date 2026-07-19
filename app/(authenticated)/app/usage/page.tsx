import { redirect } from "next/navigation";
import { UsageDashboard } from "@/components/usage/UsageDashboard";
import { auditActionEnum } from "@/db/schema";
import type { AuditAction } from "@/lib/audit/audit-actions";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { loadUsageDashboard } from "@/lib/usage/usage-dashboard";

const BASE_PATH = "/app/usage";

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseAuditAction(value: string | undefined): AuditAction | null {
  return (auditActionEnum.enumValues as readonly string[]).includes(value ?? "")
    ? (value as AuditAction)
    : null;
}

function buildHref(
  current: Record<string, string>,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  return query ? `${BASE_PATH}?${query}` : BASE_PATH;
}

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "manageUsage"))
    redirect("/app/access-denied");

  const params = await searchParams;
  const ledgerPage = parsePage(firstValue(params.ledgerPage));
  const auditPage = parsePage(firstValue(params.auditPage));
  const auditAction = parseAuditAction(firstValue(params.auditAction));

  const workspaceId = context.activeMembership.workspaceId;
  const view = await loadUsageDashboard({
    workspaceId,
    ledgerPage,
    auditPage,
    auditAction,
  });

  const current: Record<string, string> = {};
  if (ledgerPage > 1) current.ledgerPage = String(ledgerPage);
  if (auditPage > 1) current.auditPage = String(auditPage);
  if (auditAction) current.auditAction = auditAction;

  const ledgerNav = {
    prevHref:
      view.ledger.page > 1
        ? buildHref(current, { ledgerPage: String(view.ledger.page - 1) })
        : null,
    nextHref:
      view.ledger.page < view.ledger.pageCount
        ? buildHref(current, { ledgerPage: String(view.ledger.page + 1) })
        : null,
  };
  const auditNav = {
    prevHref:
      view.audit.page > 1
        ? buildHref(current, { auditPage: String(view.audit.page - 1) })
        : null,
    nextHref:
      view.audit.page < view.audit.pageCount
        ? buildHref(current, { auditPage: String(view.audit.page + 1) })
        : null,
  };

  return (
    <UsageDashboard
      workspaceId={workspaceId}
      view={view}
      ledgerNav={ledgerNav}
      auditNav={auditNav}
    />
  );
}
