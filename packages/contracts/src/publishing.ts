import { z } from "zod";

/** App credentials from TikTok's Sandbox tab, never TikTok account passwords. */
export const tikTokSandboxCredentialsSchema = z.object({
  clientKey: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_-]+$/),
  clientSecret: z.string().trim().min(1).max(256).regex(/^\S+$/),
});

export type TikTokSandboxCredentials = z.infer<
  typeof tikTokSandboxCredentialsSchema
>;
