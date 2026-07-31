"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useState, useTransition } from "react";
import { updateThemePreferenceAction } from "@/app/(authenticated)/app/actions";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { UserThemePreference } from "@/db/schema";
import { nextTheme, themeClassName } from "@/lib/theme/theme-classes";

const THEME_ICON: Record<UserThemePreference, typeof Sun> = {
  light: Sun,
  dim: SunMoon,
  dark: Moon,
};

const THEME_LABEL: Record<UserThemePreference, string> = {
  light: "Light mode",
  dim: "Dim mode",
  dark: "Dark mode",
};

function applyThemeClass(theme: UserThemePreference) {
  const target = themeClassName(theme);
  const root = document.documentElement;
  root.classList.toggle("dark", target === "dark");
  root.classList.toggle("dim", target === "dim");
}

/**
 * Cycles light -> dim -> dark -> light. The icon and label shown are always
 * the theme a click will switch *to*, matching the single-button toggle this
 * replaced rather than showing the current state.
 */
export function ThemeToggle({
  initialTheme,
}: {
  initialTheme: UserThemePreference;
}) {
  const [theme, setTheme] = useState<UserThemePreference>(initialTheme);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const previous = theme;
    const next = nextTheme(previous);

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

  const target = nextTheme(theme);
  const Icon = THEME_ICON[target];

  return (
    <SidebarMenuButton
      disabled={isPending}
      onClick={toggle}
      tooltip={`Switch to ${THEME_LABEL[target].toLowerCase()}`}
    >
      <Icon />
      <span>{THEME_LABEL[target]}</span>
    </SidebarMenuButton>
  );
}
