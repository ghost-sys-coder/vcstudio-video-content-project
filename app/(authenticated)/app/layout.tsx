import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findWorkspaceLogo } from "@/db/repositories/storage-objects.repository";
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can, canManageWorkspace } from "@/lib/policies/workspace-policy";
import { createWorkspaceLogoDownloadUrl } from "@/lib/storage/workspace-logo-storage";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthenticatedWorkspaceContext();

  if (!context) {
    redirect("/onboarding");
  }

  const [cookieStore, logo] = await Promise.all([
    cookies(),
    findWorkspaceLogo(context.activeMembership.workspaceId),
  ]);
  const logoUrl = logo
    ? await createWorkspaceLogoDownloadUrl(logo.objectKey)
    : null;

  return (
    <ApplicationShell
      activeMembership={context.activeMembership}
      canManageSettings={canManageWorkspace(context.activeMembership.role)}
      canManageUsage={can(context.activeMembership.role, "manageUsage")}
      defaultSidebarOpen={cookieStore.get("sidebar_state")?.value !== "false"}
      logoUrl={logoUrl}
      memberships={context.memberships}
      user={context.user}
    >
      {children}
    </ApplicationShell>
  );
}
