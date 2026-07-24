"use client";

import { useEffect } from "react";
import type { UserThemePreference } from "@/db/schema";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/theme/theme-cookie";

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
    document.documentElement.classList.toggle("dark", targetTheme === "dark");
    document.cookie = `${THEME_COOKIE}=${targetTheme}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}`;
  }, [targetTheme]);

  return null;
}
