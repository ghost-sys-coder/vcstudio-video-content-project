import { z } from "zod";

export const updateThemePreferenceSchema = z.object({
  theme: z.enum(["light", "dark"]),
});
