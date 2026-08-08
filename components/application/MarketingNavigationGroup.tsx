"use client";

import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  FileCheck2,
  Images,
  MessagesSquare,
  Plug,
  Repeat2,
  Send,
  Sparkles,
  Target,
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
 * The Marketing Studio is a third segment, beside the video pipeline and social
 * publishing rather than inside either. It originates content for a business;
 * the pipeline renders video; the Social segment delivers posts.
 *
 * Brand, Skills and Settings are deliberately absent from this list and reached
 * from the segment's own pages — eleven entries in one collapsible stops being
 * navigable.
 */
const MARKETING_ROUTES = [
  { href: "/app/marketing/chat", label: "Chat", icon: MessagesSquare },
  { href: "/app/marketing/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/app/marketing/publish", label: "Publish", icon: Send },
  { href: "/app/marketing/schedules", label: "Schedules", icon: Repeat2 },
  { href: "/app/marketing/content", label: "Content", icon: FileCheck2 },
  { href: "/app/marketing/campaigns", label: "Campaigns", icon: Target },
  { href: "/app/marketing/research", label: "Research", icon: BarChart3 },
  { href: "/app/marketing/assets", label: "Assets", icon: Images },
  { href: "/app/marketing/integrations", label: "Integrations", icon: Plug },
] as const;

export function MarketingNavigationGroup() {
  const pathname = usePathname();
  const isSectionActive = pathname.startsWith("/app/marketing");

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Marketing</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/*
            Keyed on section membership for the same reason SocialNavigationGroup
            is: Base UI silently ignores a changed uncontrolled `defaultOpen`
            after mount, so without the remount a direct link into the section
            would land on a page whose nav entry is collapsed out of sight.
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
                    tooltip="Marketing Studio"
                  />
                }
              >
                <Sparkles />
                <span>Studio</span>
                <ChevronRight className="ml-auto transition-transform duration-200 group-data-panel-open/collapsible:rotate-90 data-panel-open:rotate-90" />
              </CollapsibleTrigger>
              <CollapsiblePanel>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton
                      isActive={pathname === "/app/marketing"}
                      render={<Link href="/app/marketing" />}
                    >
                      <Sparkles />
                      <span>Home</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  {MARKETING_ROUTES.map((route) => (
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
