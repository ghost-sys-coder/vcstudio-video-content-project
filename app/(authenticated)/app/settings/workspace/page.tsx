import { redirect } from "next/navigation";
import { WorkspaceProfilePage } from "@/components/workspace/WorkspaceProfilePage";
import { findWorkspaceLogo } from "@/db/repositories/storage-objects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { canManageWorkspace } from "@/lib/policies/workspace-policy";
import { loadWorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";
import { createWorkspaceLogoDownloadUrl } from "@/lib/storage/workspace-logo-storage";

export default async function WorkspaceSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ youtube?: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!canManageWorkspace(context.activeMembership.role)) {
    redirect("/app/access-denied");
  }

  const [{ youtube }, logo, channelsView] = await Promise.all([
    searchParams,
    findWorkspaceLogo(context.activeMembership.workspaceId),
    loadWorkspaceChannelsView({
      workspaceId: context.activeMembership.workspaceId,
    }),
  ]);
  const logoUrl = logo
    ? await createWorkspaceLogoDownloadUrl(logo.objectKey)
    : null;

  return (
    <WorkspaceProfilePage
      channelsView={channelsView}
      logoUrl={logoUrl}
      oauthStatus={youtube ?? null}
      workspaceId={context.activeMembership.workspaceId}
      workspaceName={context.activeMembership.workspaceName}
    />
  );
}
