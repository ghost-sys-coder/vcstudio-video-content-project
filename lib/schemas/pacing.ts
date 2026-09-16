import { z } from "zod";
import { PACING_PROFILE_IDS } from "@/lib/pacing/pacing-profile";

/**
 * Derived from the profile list rather than repeating it, so adding a profile
 * cannot leave the form accepting one the renderer does not know.
 */
export const pacingProfileIdSchema = z.enum(
  PACING_PROFILE_IDS as [string, ...string[]],
);

export const savePacingProfileSchema = z.object({
  projectId: z.uuid(),
  pacingProfile: pacingProfileIdSchema,
});
