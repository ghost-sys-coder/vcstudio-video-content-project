import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findWorkspaceLogo } from "@/db/repositories/storage-objects.repository";
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { resolveMarketingNavigation } from "@/lib/marketing/marketing-navigation";
import { can, canManageWorkspace } from "@/lib/policies/workspace-policy";
import { createWorkspaceLogoDownloadUrl } from "@/lib/storage/workspace-logo-storage";
import { THEME_COOKIE } from "@/lib/theme/theme-cookie";
import {
  isValidThemePreference,
  normalizeThemePreference,
} from "@/lib/theme/theme-classes";

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

  const marketingNavigation = await resolveMarketingNavigation({
    workspaceId: context.activeMembership.workspaceId,
    role: context.activeMembership.role,
  });

  const cookieValue = cookieStore.get(THEME_COOKIE)?.value;
  const cookieTheme = normalizeThemePreference(cookieValue);
  const savedTheme = normalizeThemePreference(context.user.themePreference);
  const themeResyncTarget =
    savedTheme !== cookieTheme || !isValidThemePreference(cookieValue)
      ? savedTheme
      : null;

  return (
    <ApplicationShell
      {...marketingNavigation}
      activeMembership={context.activeMembership}
      canComposePosts={can(context.activeMembership.role, "composePosts")}
      canManageSettings={canManageWorkspace(context.activeMembership.role)}
      canManageUsage={can(context.activeMembership.role, "manageUsage")}
      canViewOperationalReadiness={can(
        context.activeMembership.role,
        "viewOperationalReadiness",
      )}
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
