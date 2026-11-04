import { z } from "zod";

export const waitlistInputSchema = z.object({
  emailAddress: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254),
});
