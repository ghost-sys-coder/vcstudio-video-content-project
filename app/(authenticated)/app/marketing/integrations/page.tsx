import { MarketingIntegrationsPage } from "@/components/marketing/MarketingIntegrationsPage";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMarketingIntegrationsView } from "@/lib/marketing/integrations/marketing-integrations-view";
import { canManageWorkspace } from "@/lib/policies/workspace-policy";

export default async function MarketingIntegrationsRoute() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const view = await loadMarketingIntegrationsView({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <MarketingIntegrationsPage
      canManageConnections={canManageWorkspace(context.activeMembership.role)}
      view={view}
    />
  );
}
