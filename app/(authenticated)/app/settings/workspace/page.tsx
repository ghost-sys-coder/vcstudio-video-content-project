import { redirect } from "next/navigation";
import { WorkspaceProfilePage } from "@/components/workspace/WorkspaceProfilePage";
import { findWorkspaceLogo } from "@/db/repositories/storage-objects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { canManageWorkspace } from "@/lib/policies/workspace-policy";
import { createWorkspaceLogoDownloadUrl } from "@/lib/storage/workspace-logo-storage";

export default async function WorkspaceSettingsPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!canManageWorkspace(context.activeMembership.role)) {
    redirect("/app/access-denied");
  }

  const logo = await findWorkspaceLogo(context.activeMembership.workspaceId);
  const logoUrl = logo
    ? await createWorkspaceLogoDownloadUrl(logo.objectKey)
    : null;

  return (
    <WorkspaceProfilePage
      logoUrl={logoUrl}
      workspaceId={context.activeMembership.workspaceId}
      workspaceName={context.activeMembership.workspaceName}
    />
  );
}
