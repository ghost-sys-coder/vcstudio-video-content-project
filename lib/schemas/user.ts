import { z } from "zod";

export const themePreferenceSchema = z.enum(["light", "dark"]);

export type ThemePreference = z.infer<typeof themePreferenceSchema>;

export const updateThemePreferenceSchema = z.object({
  theme: themePreferenceSchema,
});
