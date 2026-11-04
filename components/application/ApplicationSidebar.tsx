"use client";

import {
  FolderKanban,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  ReceiptText,
  Activity,
  Bell,
  Settings,
  UsersIcon,
} from "lucide-react";
import { SidebarLink } from "@/components/application/SidebarLink";
import { usePathname } from "next/navigation";
import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
import type { ThemePreference } from "@/lib/schemas/user";
import { getUserInitials } from "@/lib/users/user-initials";
import { LogoutConfirmDialog } from "@/components/application/LogoutConfirmDialog";
import { MarketingDisabledNavigationGroup } from "@/components/application/MarketingDisabledNavigationGroup";
import { MarketingNavigationGroup } from "@/components/application/MarketingNavigationGroup";
import { SocialNavigationGroup } from "@/components/application/SocialNavigationGroup";
import { ThemeSwitcher } from "@/components/application/ThemeSwitcher";
import { WorkspaceLogoImage } from "@/components/application/WorkspaceLogoImage";
import { WorkspaceSelector } from "@/components/application/WorkspaceSelector";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

export function ApplicationSidebar({
  activeMembership,
  canComposePosts,
  canManageSettings,
  canManageUsage,
  canViewOperationalReadiness,
  canViewMarketingStudio,
  initialTheme,
  logoUrl,
  marketingDeploymentEnabled,
  marketingStudioEnabled,
  memberships,
  userDisplayName,
  userEmail,
}: {
  activeMembership: WorkspaceMembershipView;
  canComposePosts: boolean;
  canManageSettings: boolean;
  canManageUsage: boolean;
  canViewOperationalReadiness: boolean;
  canViewMarketingStudio: boolean;
  initialTheme: ThemePreference;
  logoUrl: string | null;
  marketingDeploymentEnabled: boolean;
  marketingStudioEnabled: boolean;
  memberships: WorkspaceMembershipView[];
  userDisplayName: string;
  userEmail: string;
}) {
  const pathname = usePathname();
  const initials = getUserInitials(userDisplayName, userEmail);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<SidebarLink href="/app" />}
              size="lg"
              tooltip={activeMembership.workspaceName}
            >
              <WorkspaceLogoImage
                logoUrl={logoUrl}
                name={activeMembership.workspaceName}
              />
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {activeMembership.workspaceName}
                </span>
                <span className="block truncate text-xs text-muted-foreground capitalize">
                  {activeMembership.role} workspace
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="group-data-[collapsible=icon]:hidden">
          <WorkspaceSelector
            activeWorkspaceId={activeMembership.workspaceId}
            memberships={memberships}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/app"}
                  render={<SidebarLink href="/app" />}
                  tooltip="Dashboard"
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/app/activity")}
                  render={<SidebarLink href="/app/activity" />}
                  tooltip="Activity"
                >
                  <Bell />
                  <span>Activity</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/app/queue")}
                  render={<SidebarLink href="/app/queue" />}
                  tooltip="Production queue"
                >
                  <ListChecks />
                  <span>Queue</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/app/ideas")}
                  render={<SidebarLink href="/app/ideas" />}
                  tooltip="Idea Lab"
                >
                  <Lightbulb />
                  <span>Idea Lab</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/app/characters")}
                  render={<SidebarLink href="/app/characters" />}
                  tooltip="Characters"
                >
                  <UsersIcon />
                  <span>Characters</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/app/projects")}
                  render={<SidebarLink href="/app/projects" />}
                  tooltip="Projects"
                >
                  <FolderKanban />
                  <span>Projects</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {canManageUsage ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith("/app/usage")}
                    render={<SidebarLink href="/app/usage" />}
                    tooltip="Usage & budgets"
                  >
                    <ReceiptText />
                    <span>Usage &amp; budgets</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {canViewOperationalReadiness ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith("/app/readiness")}
                    render={<SidebarLink href="/app/readiness" />}
                    tooltip="Operational readiness"
                  >
                    <Activity />
                    <span>Readiness</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/app/settings/mcp")}
                  render={<SidebarLink href="/app/settings/mcp" />}
                  tooltip="AI connections"
                >
                  <Settings />
                  <span>AI connections</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {canManageSettings ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith("/app/settings/workspace")}
                    render={<SidebarLink href="/app/settings/workspace" />}
                    tooltip="Workspace settings"
                  >
                    <Settings />
                    <span>Workspace settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {canComposePosts ? <SocialNavigationGroup /> : null}
        {canViewMarketingStudio ? (
          marketingStudioEnabled ? (
            <MarketingNavigationGroup />
          ) : (
            <MarketingDisabledNavigationGroup
              canManageSettings={canManageSettings}
              deploymentEnabled={marketingDeploymentEnabled}
            />
          )
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        {/* The shared menu runs flush by default, which reads as one control
            here: the theme pill and the account row are unrelated and should
            not look joined. */}
        <SidebarMenu className="gap-2">
          <ThemeSwitcher initialTheme={initialTheme} />
          <SidebarMenuItem>
            <LogoutConfirmDialog
              initials={initials}
              userDisplayName={userDisplayName}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
