"use client";

import { useEffect } from "react";
import type { ThemePreference } from "@/lib/schemas/user";
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
  targetTheme: ThemePreference | null;
}) {
  useEffect(() => {
    if (!targetTheme) return;
    const target = themeClassName(targetTheme);
    const root = document.documentElement;
    root.classList.toggle("dark", target === "dark");
    root.classList.remove("dim");
    document.cookie = `${THEME_COOKIE}=${targetTheme}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}`;
  }, [targetTheme]);

  return null;
}
