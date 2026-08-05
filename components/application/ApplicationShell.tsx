import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
import type { ApplicationUser, UserThemePreference } from "@/db/schema";
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
  canUseMarketingStudio,
  children,
  defaultSidebarOpen,
  initialTheme,
  logoUrl,
  marketingStudioEnabled,
  memberships,
  themeResyncTarget,
  user,
}: {
  activeMembership: WorkspaceMembershipView;
  canComposePosts: boolean;
  canManageSettings: boolean;
  canManageUsage: boolean;
  canUseMarketingStudio: boolean;
  children: React.ReactNode;
  defaultSidebarOpen: boolean;
  initialTheme: UserThemePreference;
  logoUrl: string | null;
  marketingStudioEnabled: boolean;
  memberships: WorkspaceMembershipView[];
  themeResyncTarget: UserThemePreference | null;
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
        canUseMarketingStudio={canUseMarketingStudio}
        initialTheme={initialTheme}
        logoUrl={logoUrl}
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
        <main className="w-full min-w-0 max-w-full flex-1 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
