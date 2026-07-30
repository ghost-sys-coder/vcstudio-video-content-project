import { redirect } from "next/navigation";
import { ConnectedAccountsPanel } from "@/components/social/ConnectedAccountsPanel";
import { listPlatformConnections } from "@/db/repositories/publishing.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { CONTENT_PLATFORM_LABELS } from "@/lib/platforms/platform-labels";
import { can } from "@/lib/policies/workspace-policy";

export default async function SocialAccountsPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "composePosts"))
    redirect("/app/access-denied");

  const connections = await listPlatformConnections({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <ConnectedAccountsPanel
      connections={connections.map((connection) => ({
        id: connection.id,
        platform: connection.platform,
        platformLabel: CONTENT_PLATFORM_LABELS[connection.platform],
        accountName: connection.externalAccountName,
        status: connection.status,
      }))}
    />
  );
}
