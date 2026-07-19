"use client";

import {
  FolderKanban,
  LayoutDashboard,
  ReceiptText,
  Settings,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
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
  canManageSettings,
  canManageUsage,
  logoUrl,
  memberships,
}: {
  activeMembership: WorkspaceMembershipView;
  canManageSettings: boolean;
  canManageUsage: boolean;
  logoUrl: string | null;
  memberships: WorkspaceMembershipView[];
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/app" />}
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
                  render={<Link href="/app" />}
                  tooltip="Dashboard"
                >
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/app/characters")}
                  render={<Link href="/app/characters" />}
                  tooltip="Characters"
                >
                  <UsersIcon />
                  <span>Characters</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith("/app/projects")}
                  render={<Link href="/app/projects" />}
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
                    render={<Link href="/app/usage" />}
                    tooltip="Usage & budgets"
                  >
                    <ReceiptText />
                    <span>Usage &amp; budgets</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {canManageSettings ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname.startsWith("/app/settings/workspace")}
                    render={<Link href="/app/settings/workspace" />}
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
      </SidebarContent>
      <SidebarFooter className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground group-data-[collapsible=icon]:hidden">
        VCStudio production console
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
