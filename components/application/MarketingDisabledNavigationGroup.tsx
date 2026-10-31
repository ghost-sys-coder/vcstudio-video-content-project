"use client";

import { Lock, Sparkles } from "lucide-react";
import { SidebarLink } from "@/components/application/SidebarLink";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

/** Static navigation for a deployment pause or a workspace that is switched off. */
export function MarketingDisabledNavigationGroup({
  canManageSettings,
  deploymentEnabled,
}: {
  canManageSettings: boolean;
  deploymentEnabled: boolean;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Marketing</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Dialog>
              <DialogTrigger
                aria-label={
                  deploymentEnabled
                    ? "Marketing Studio — switched off"
                    : "Marketing Studio — paused"
                }
                render={
                  <SidebarMenuButton
                    tooltip={
                      deploymentEnabled
                        ? "Marketing Studio — switched off"
                        : "Marketing Studio — paused"
                    }
                  />
                }
              >
                <Sparkles />
                <span>Studio</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {deploymentEnabled ? "Off" : "Paused"}
                </span>
                <Lock className="size-3.5 text-muted-foreground" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {deploymentEnabled
                      ? "The Marketing Studio is off"
                      : "Marketing Studio is paused"}
                  </DialogTitle>
                  <DialogDescription>
                    {!deploymentEnabled
                      ? "Marketing Studio is paused to conserve Trigger.dev and Neon credits. It will stay inactive until you choose to resume it."
                      : canManageSettings
                        ? "It is switched off for this workspace. Turn it on in workspace settings and it will appear here straight away."
                        : "It is switched off for this workspace. A workspace owner can turn it on from workspace settings."}
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border border-notice-info-edge bg-notice-info p-3 text-sm text-notice-info-foreground">
                  {deploymentEnabled
                    ? "The Studio drafts content with AI, so it spends from this workspace’s budget. That is why it starts switched off rather than on."
                    : "Opening this menu does not load marketing data or start background work."}
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Close
                  </DialogClose>
                  {deploymentEnabled && canManageSettings ? (
                    <DialogClose
                      nativeButton={false}
                      render={
                        <Button
                          nativeButton={false}
                          render={
                            <SidebarLink href="/app/settings/workspace" />
                          }
                        />
                      }
                    >
                      Open workspace settings
                    </DialogClose>
                  ) : null}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
