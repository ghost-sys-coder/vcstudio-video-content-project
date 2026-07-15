import Link from "next/link";
import type { ApplicationUser } from "@/db/schema";
import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { UserAccountMenu } from "@/components/application/UserAccountMenu";
import { WorkspaceSelector } from "@/components/application/WorkspaceSelector";

export function ApplicationShell({
  activeMembership,
  children,
  memberships,
  user,
}: {
  activeMembership: WorkspaceMembershipView;
  children: React.ReactNode;
  memberships: WorkspaceMembershipView[];
  user: ApplicationUser;
}) {
  return (
    <div className="min-h-screen bg-muted/20">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-5 sm:px-8">
          <div className="mr-auto">
            <Link aria-label="VCStudio dashboard" href="/app">
              <BrandLogo />
            </Link>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Production console
            </p>
          </div>
          <WorkspaceSelector
            activeWorkspaceId={activeMembership.workspaceId}
            memberships={memberships}
          />
          <UserAccountMenu displayName={user.displayName} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
        {children}
      </main>
    </div>
  );
}
