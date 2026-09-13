"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useState, useTransition } from "react";
import { updateThemePreferenceAction } from "@/app/(authenticated)/app/actions";
import { SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { UserThemePreference } from "@/db/schema";
import { themeClassName } from "@/lib/theme/theme-classes";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: {
  value: UserThemePreference;
  label: string;
  Icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dim", label: "Dim", Icon: SunMoon },
  { value: "dark", label: "Dark", Icon: Moon },
];

function applyThemeClass(theme: UserThemePreference) {
  const target = themeClassName(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", target === "dark");
  root.classList.toggle("dim", target === "dim");
}

/**
 * Three-way segmented control (light / dim / dark) in the sidebar footer.
 *
 * Replaces a single click-to-cycle button: with three themes a cycle button
 * can only ever show what a click leads to *next*, never which theme is
 * actually active. This keeps the current theme visibly selected at all
 * times and reaches any theme in exactly one click.
 *
 * Colors are overridden to the sidebar's own `--sidebar-*` tokens rather than
 * the page-level `--background`/`--muted` the shared `Tabs` primitive uses by
 * default — the sidebar has its own background, distinct from the page's, so
 * the default styling would look like a mismatched patch pasted into it.
 */
export function ThemeSwitcher({
  initialTheme,
}: {
  initialTheme: UserThemePreference;
}) {
  const [theme, setTheme] = useState<UserThemePreference>(initialTheme);
  const [isPending, startTransition] = useTransition();
  const { isMobile, state } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  function select(next: UserThemePreference) {
    if (next === theme) return;
    const previous = theme;

    setTheme(next);
    applyThemeClass(next);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("theme", next);
      const result = await updateThemePreferenceAction(formData);
      if (!result.success) {
        setTheme(previous);
        applyThemeClass(previous);
      }
    });
  }

  return (
    <SidebarMenuItem>
      <Tabs
        aria-label="Theme"
        onValueChange={(value) => select(value as UserThemePreference)}
        orientation={collapsed ? "vertical" : "horizontal"}
        value={theme}
      >
        <TabsList
          className={cn(
            "bg-sidebar-accent",
            // Collapsed, the control is one icon wide and sits on the same
            // vertical line as the navigation icons above it, rather than
            // stretching to a rail narrower than the icon plus its padding.
            collapsed ? "w-8 gap-0.5 p-0.5" : "w-full",
          )}
        >
          {THEME_OPTIONS.map(({ value, label, Icon }) => (
            <Tooltip key={value}>
              <TooltipTrigger
                render={
                  <TabsTrigger
                    aria-label={label}
                    className={cn(
                      "text-sidebar-foreground/70 hover:text-sidebar-foreground data-active:border-transparent data-active:bg-sidebar data-active:text-sidebar-foreground dark:data-active:border-transparent dark:data-active:bg-sidebar dark:data-active:text-sidebar-foreground",
                      // A vertical tab list left-aligns its triggers, which is
                      // right when each one carries a label. Collapsed there is
                      // no label, only the icon, so left-alignment plus the
                      // trigger's own side padding pushed it off the rail's
                      // centre and hard against the right edge. Written with the
                      // same variant prefix the default uses, so the merge drops
                      // that rule instead of losing to its higher specificity.
                      collapsed &&
                        "size-7 px-0 group-data-vertical/tabs:justify-center",
                    )}
                    disabled={isPending}
                    value={value}
                  />
                }
              >
                <Icon aria-hidden />
                {!collapsed ? <span>{label}</span> : null}
              </TooltipTrigger>
              <TooltipContent align="center" hidden={!collapsed} side="right">
                {label}
              </TooltipContent>
            </Tooltip>
          ))}
        </TabsList>
      </Tabs>
    </SidebarMenuItem>
  );
}
