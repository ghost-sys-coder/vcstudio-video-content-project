import type { UserThemePreference } from "@/db/schema";

/**
 * The three themes sit on one dial — light, dim, dark — so a single button can
 * still cycle through all of them the way the old light/dark toggle did.
 */
const THEME_CYCLE: readonly UserThemePreference[] = ["light", "dim", "dark"];

export function nextTheme(current: UserThemePreference): UserThemePreference {
  const index = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(index + 1) % THEME_CYCLE.length];
}

/**
 * The class the `<html>` element carries for a theme. Light is the unmarked
 * default — no class — matching the `:root` variables in `globals.css`; dark
 * and dim each get their own class so their variable blocks never have to be
 * layered on top of one another.
 */
export function themeClassName(
  theme: UserThemePreference,
): "dark" | "dim" | null {
  if (theme === "dark") return "dark";
  if (theme === "dim") return "dim";
  return null;
}

export function isValidThemePreference(
  value: string | undefined,
): value is UserThemePreference {
  return value === "light" || value === "dim" || value === "dark";
}
