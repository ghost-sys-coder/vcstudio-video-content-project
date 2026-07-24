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
  canManageSettings,
  canManageUsage,
  children,
  defaultSidebarOpen,
  initialTheme,
  logoUrl,
  memberships,
  themeResyncTarget,
  user,
}: {
  activeMembership: WorkspaceMembershipView;
  canManageSettings: boolean;
  canManageUsage: boolean;
  children: React.ReactNode;
  defaultSidebarOpen: boolean;
  initialTheme: UserThemePreference;
  logoUrl: string | null;
  memberships: WorkspaceMembershipView[];
  themeResyncTarget: UserThemePreference | null;
  user: ApplicationUser;
}) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <ThemeResyncEffect targetTheme={themeResyncTarget} />
      <ApplicationSidebar
        activeMembership={activeMembership}
        canManageSettings={canManageSettings}
        canManageUsage={canManageUsage}
        initialTheme={initialTheme}
        logoUrl={logoUrl}
        memberships={memberships}
        userDisplayName={user.displayName}
        userEmail={user.email}
      />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {activeMembership.workspaceName}
            </p>
          </div>
          <UserAccountMenu displayName={user.displayName} />
        </header>
        <main className="w-full min-w-0 max-w-full flex-1 px-5 py-8 sm:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
