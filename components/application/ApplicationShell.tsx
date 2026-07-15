import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
import type { ApplicationUser } from "@/db/schema";
import { ApplicationSidebar } from "@/components/application/ApplicationSidebar";
import { UserAccountMenu } from "@/components/application/UserAccountMenu";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function ApplicationShell({
  activeMembership,
  canManageSettings,
  children,
  defaultSidebarOpen,
  logoUrl,
  memberships,
  user,
}: {
  activeMembership: WorkspaceMembershipView;
  canManageSettings: boolean;
  children: React.ReactNode;
  defaultSidebarOpen: boolean;
  logoUrl: string | null;
  memberships: WorkspaceMembershipView[];
  user: ApplicationUser;
}) {
  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <ApplicationSidebar
        activeMembership={activeMembership}
        canManageSettings={canManageSettings}
        logoUrl={logoUrl}
        memberships={memberships}
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {activeMembership.workspaceName}
            </p>
          </div>
          <UserAccountMenu displayName={user.displayName} />
        </header>
        <main className="w-full flex-1 px-5 py-8 sm:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
