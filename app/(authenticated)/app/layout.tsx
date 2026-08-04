import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findWorkspaceLogo } from "@/db/repositories/storage-objects.repository";
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getMarketingEnvironment } from "@/lib/env/server";
import { can, canManageWorkspace } from "@/lib/policies/workspace-policy";
import { createWorkspaceLogoDownloadUrl } from "@/lib/storage/workspace-logo-storage";
import { THEME_COOKIE } from "@/lib/theme/theme-cookie";
import { isValidThemePreference } from "@/lib/theme/theme-classes";

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

  const cookieValue = cookieStore.get(THEME_COOKIE)?.value;
  const cookieTheme = isValidThemePreference(cookieValue)
    ? cookieValue
    : "light";
  const themeResyncTarget =
    context.user.themePreference !== cookieTheme
      ? context.user.themePreference
      : null;

  return (
    <ApplicationShell
      activeMembership={context.activeMembership}
      canComposePosts={can(context.activeMembership.role, "composePosts")}
      canManageSettings={canManageWorkspace(context.activeMembership.role)}
      canManageUsage={can(context.activeMembership.role, "manageUsage")}
      canUseMarketingStudio={
        getMarketingEnvironment().ENABLE_MARKETING_STUDIO &&
        can(context.activeMembership.role, "useMarketingChat")
      }
      defaultSidebarOpen={cookieStore.get("sidebar_state")?.value !== "false"}
      initialTheme={cookieTheme}
      logoUrl={logoUrl}
      memberships={context.memberships}
      themeResyncTarget={themeResyncTarget}
      user={context.user}
    >
      {children}
    </ApplicationShell>
  );
}
