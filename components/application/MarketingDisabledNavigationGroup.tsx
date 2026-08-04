"use client";

import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
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

/**
 * The Marketing entry while the workspace has the studio switched off.
 *
 * Shown rather than hidden, because the two states mean different things to a
 * user: a hidden entry says "this app has no marketing feature", while a locked
 * one says "it has one and it is off". Only the second is true here, and only
 * the second is actionable.
 *
 * It collapses to a **single** row instead of the seven-item menu — offering
 * seven links that all open the same dialog would be noise — and the dialog
 * tells the user what to do, which differs by role: an owner is given the link,
 * everybody else is told who to ask, because sending an editor to a settings
 * page that will bounce them to access-denied is worse than saying so up front.
 */
export function MarketingDisabledNavigationGroup({
  canManageSettings,
}: {
  canManageSettings: boolean;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Marketing</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <Dialog>
              <DialogTrigger
                render={
                  <SidebarMenuButton tooltip="Marketing Studio — switched off" />
                }
              >
                <Sparkles />
                <span>Studio</span>
                <Lock className="ml-auto size-3.5 text-muted-foreground" />
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>The Marketing Studio is off</DialogTitle>
                  <DialogDescription>
                    {canManageSettings
                      ? "It is switched off for this workspace. Turn it on in workspace settings and it will appear here straight away."
                      : "It is switched off for this workspace. A workspace owner can turn it on from workspace settings."}
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border border-notice-info-edge bg-notice-info p-3 text-sm text-notice-info-foreground">
                  The Studio drafts content with AI, so it spends from this
                  workspace&apos;s budget. That is why it starts switched off
                  rather than on.
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Close
                  </DialogClose>
                  {canManageSettings ? (
                    <DialogClose
                      render={
                        <Button
                          render={<Link href="/app/settings/workspace" />}
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
