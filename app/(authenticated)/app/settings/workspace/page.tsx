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
  searchParams: Promise<{ facebook?: string; youtube?: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!canManageWorkspace(context.activeMembership.role)) {
    redirect("/app/access-denied");
  }

  const [{ facebook, youtube }, logo, channelsView] = await Promise.all([
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
      oauthStatus={{ facebook: facebook ?? null, youtube: youtube ?? null }}
      workspaceId={context.activeMembership.workspaceId}
      workspaceName={context.activeMembership.workspaceName}
    />
  );
}
