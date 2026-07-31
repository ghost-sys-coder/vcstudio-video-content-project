"use client";

import { useEffect } from "react";
import type { UserThemePreference } from "@/db/schema";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/theme/theme-cookie";
import { themeClassName } from "@/lib/theme/theme-classes";

/**
 * Fixes a stale or missing theme cookie on this device (e.g. first sign-in
 * on a new browser) against the durable per-user DB value, without waiting
 * on a server round trip.
 */
export function ThemeResyncEffect({
  targetTheme,
}: {
  targetTheme: UserThemePreference | null;
}) {
  useEffect(() => {
    if (!targetTheme) return;
    const target = themeClassName(targetTheme);
    const root = document.documentElement;
    root.classList.toggle("dark", target === "dark");
    root.classList.toggle("dim", target === "dim");
    document.cookie = `${THEME_COOKIE}=${targetTheme}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}`;
  }, [targetTheme]);

  return null;
}
