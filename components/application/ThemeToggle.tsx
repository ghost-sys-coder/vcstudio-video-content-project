"use client";

import { Moon, Sun } from "lucide-react";
import { useState, useTransition } from "react";
import { updateThemePreferenceAction } from "@/app/(authenticated)/app/actions";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import type { UserThemePreference } from "@/db/schema";

export function ThemeToggle({
  initialTheme,
}: {
  initialTheme: UserThemePreference;
}) {
  const [theme, setTheme] = useState<UserThemePreference>(initialTheme);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const previous = theme;
    const next: UserThemePreference = previous === "dark" ? "light" : "dark";

    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");

    startTransition(async () => {
      const formData = new FormData();
      formData.set("theme", next);
      const result = await updateThemePreferenceAction(formData);
      if (!result.success) {
        setTheme(previous);
        document.documentElement.classList.toggle("dark", previous === "dark");
      }
    });
  }

  return (
    <SidebarMenuButton
      disabled={isPending}
      onClick={toggle}
      tooltip={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </SidebarMenuButton>
  );
}
