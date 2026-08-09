import { MarketingIntegrationsPage } from "@/components/marketing/MarketingIntegrationsPage";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMarketingIntegrationsView } from "@/lib/marketing/integrations/marketing-integrations-view";
import { canManageWorkspace } from "@/lib/policies/workspace-policy";

const GOOGLE_BUSINESS_MESSAGES: Record<string, string> = {
  connected:
    "Google Business Profile connected. Select the locations Marketing Studio should use.",
  cancelled: "Google Business Profile connection was cancelled.",
  failed:
    "Google Business Profile could not be connected. Confirm API access and try again.",
  forbidden: "You do not have permission to connect Google Business Profile.",
  invalid:
    "The Google Business Profile authorization response was invalid or expired.",
};

export default async function MarketingIntegrationsRoute({
  searchParams,
}: {
  searchParams: Promise<{ googleBusiness?: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const view = await loadMarketingIntegrationsView({
    workspaceId: context.activeMembership.workspaceId,
    googleBusinessMessage:
      GOOGLE_BUSINESS_MESSAGES[(await searchParams).googleBusiness ?? ""] ??
      null,
  });

  return (
    <MarketingIntegrationsPage
      canManageConnections={canManageWorkspace(context.activeMembership.role)}
      view={view}
    />
  );
}
