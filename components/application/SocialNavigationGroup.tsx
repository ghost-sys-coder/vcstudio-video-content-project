"use client";

import {
  CalendarDays,
  ChevronRight,
  Images,
  Megaphone,
  PenLine,
  Plug,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

/**
 * Social publishing is a second segment beside the video pipeline, not a part of
 * it — a workspace media library and post schedule exist independently of any
 * project. It gets its own collapsible group so the flat Workspace list stays
 * readable as this grows.
 */
const SOCIAL_ROUTES = [
  { href: "/app/social/posts", label: "Posts", icon: PenLine },
  { href: "/app/social/calendar", label: "Schedule", icon: CalendarDays },
  { href: "/app/social/library", label: "Media library", icon: Images },
  { href: "/app/social/accounts", label: "Accounts", icon: Plug },
] as const;

export function SocialNavigationGroup() {
  const pathname = usePathname();
  const isSectionActive = pathname.startsWith("/app/social");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Social</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/*
            Open by default whenever the user is inside the section, so a direct
            link or a refresh never lands on a page whose nav entry is hidden.

            Keyed on that so entering or leaving the section remounts the group
            and re-reads `defaultOpen`. Without the key, navigating in would
            change an uncontrolled component's initial value after mount — which
            Base UI warns about and, worse, silently ignores. Manual toggles
            still persist while the user stays on the same side of the boundary.
          */}
          <Collapsible
            defaultOpen={isSectionActive}
            key={String(isSectionActive)}
          >
            <SidebarMenuItem>
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    isActive={isSectionActive}
                    tooltip="Social publishing"
                  />
                }
              >
                <Megaphone />
                <span>Publishing</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-[panel-open]/collapsible:rotate-90 data-[panel-open]:rotate-90" />
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <SidebarMenuSub>
                  {SOCIAL_ROUTES.map((route) => (
                    <SidebarMenuSubItem key={route.href}>
                      <SidebarMenuSubButton
                        isActive={pathname.startsWith(route.href)}
                        render={<Link href={route.href} />}
                      >
                        <route.icon />
                        <span>{route.label}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsiblePanel>
            </SidebarMenuItem>
          </Collapsible>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
