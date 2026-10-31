import type { ThemePreference } from "@/lib/schemas/user";

export function nextTheme(current: ThemePreference): ThemePreference {
  return current === "light" ? "dark" : "light";
}

/** Light uses the unmarked :root palette; Dark uses the dark class. */
export function themeClassName(theme: ThemePreference): "dark" | null {
  return theme === "dark" ? "dark" : null;
}

export function isValidThemePreference(
  value: unknown,
): value is ThemePreference {
  return value === "light" || value === "dark";
}

/** Read legacy Dim cookies and stored preferences as Dark without database writes. */
export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === "dark" || value === "dim" ? "dark" : "light";
}
