import { redirect } from "next/navigation";
import { OperationalReadinessDashboard } from "@/components/readiness/OperationalReadinessDashboard";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { loadCachedOperationalReadiness } from "@/lib/readiness/readiness";

export default async function ReadinessPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "viewOperationalReadiness"))
    redirect("/app/access-denied");
  const view = await loadCachedOperationalReadiness(
    context.activeMembership.workspaceId,
  );
  return <OperationalReadinessDashboard view={view} />;
}
