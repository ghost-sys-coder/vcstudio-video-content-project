import { z } from "zod";

const connectionOAuthStatusSchema = z
  .enum(["connected", "cancelled", "failed", "forbidden", "invalid", "expired"])
  .nullable()
  .catch(null);

/** Only known, non-sensitive status codes may be shown or forwarded. */
export const connectionOAuthQuerySchema = z.object({
  facebook: connectionOAuthStatusSchema,
  instagram: connectionOAuthStatusSchema,
  linkedin: connectionOAuthStatusSchema,
  linkedinPages: connectionOAuthStatusSchema.optional(),
  tiktok: connectionOAuthStatusSchema,
  x: connectionOAuthStatusSchema,
  youtube: connectionOAuthStatusSchema,
});

export type ConnectionOAuthStatus = z.infer<typeof connectionOAuthQuerySchema>;
