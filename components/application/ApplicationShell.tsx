import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
import type { ApplicationUser } from "@/db/schema";
import type { ThemePreference } from "@/lib/schemas/user";
import { ApplicationSidebar } from "@/components/application/ApplicationSidebar";
import { ThemeResyncEffect } from "@/components/application/ThemeResyncEffect";
import { UserAccountMenu } from "@/components/application/UserAccountMenu";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function ApplicationShell({
  activeMembership,
  canComposePosts,
  canManageSettings,
  canManageUsage,
  canViewOperationalReadiness,
  canViewMarketingStudio,
  children,
  defaultSidebarOpen,
  initialTheme,
  logoUrl,
  marketingDeploymentEnabled,
  marketingStudioEnabled,
  memberships,
  themeResyncTarget,
  user,
}: {
  activeMembership: WorkspaceMembershipView;
  canComposePosts: boolean;
  canManageSettings: boolean;
  canManageUsage: boolean;
  canViewOperationalReadiness: boolean;
  canViewMarketingStudio: boolean;
  children: React.ReactNode;
  defaultSidebarOpen: boolean;
  initialTheme: ThemePreference;
  logoUrl: string | null;
  marketingDeploymentEnabled: boolean;
  marketingStudioEnabled: boolean;
  memberships: WorkspaceMembershipView[];
  themeResyncTarget: ThemePreference | null;
  user: ApplicationUser;
}) {
  return (
    <SidebarProvider className="app-shell" defaultOpen={defaultSidebarOpen}>
      <ThemeResyncEffect targetTheme={themeResyncTarget} />
      <ApplicationSidebar
        activeMembership={activeMembership}
        canComposePosts={canComposePosts}
        canManageSettings={canManageSettings}
        canManageUsage={canManageUsage}
        canViewOperationalReadiness={canViewOperationalReadiness}
        canViewMarketingStudio={canViewMarketingStudio}
        initialTheme={initialTheme}
        logoUrl={logoUrl}
        marketingDeploymentEnabled={marketingDeploymentEnabled}
        marketingStudioEnabled={marketingStudioEnabled}
        memberships={memberships}
        userDisplayName={user.displayName}
        userEmail={user.email}
      />
      <SidebarInset className="min-w-0 overflow-x-clip border border-border/60 bg-background/88 shadow-[0_24px_70px_-42px_color-mix(in_oklch,var(--foreground)_32%,transparent)] backdrop-blur-sm">
        <header className="sticky top-2 z-20 mx-3 mt-3 flex h-14 items-center gap-3 rounded-2xl border border-border/70 bg-card/88 px-4 shadow-[0_12px_32px_-24px_color-mix(in_oklch,var(--foreground)_36%,transparent)] backdrop-blur-xl sm:px-5">
          <SidebarTrigger />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {activeMembership.workspaceName}
            </p>
          </div>
          <UserAccountMenu displayName={user.displayName} />
        </header>
        {/* Padding cut to 15% of its previous size, as asked: 20px->3px and
            32px->5px across, 32px->5px and 40px->6px at the larger breakpoints.
            Arbitrary values because the scale has nothing at 3px or 5px. */}
        <main className="w-full min-w-0 max-w-full flex-1 px-[3px] py-[5px] sm:px-[5px] lg:px-1.5 lg:py-1.5">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
