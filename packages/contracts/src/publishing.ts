import { z } from "zod";

export const facebookPageIdSchema = z
  .string()
  .trim()
  .regex(/^\d{1,32}$/, "Enter the numeric Facebook Page ID.");

/** Safe for client props and action results; never include Page tokens. */
export type FacebookPageOption = {
  externalAccountId: string;
  externalAccountName: string;
};

export type FacebookPageLookupState = {
  page: FacebookPageOption | null;
  error: string | null;
};

export const socialYouTubeSettingsSchema = z.object({
  title: z.string().trim().max(100).default(""),
  description: z.string().max(5000).nullable().default(null),
  tags: z
    .array(z.string().trim().min(1).max(80))
    .max(30)
    .default([])
    .refine(
      (tags) =>
        tags.map((tag) => (tag.includes(" ") ? `"${tag}"` : tag)).join(",")
          .length <= 500,
      "YouTube tags must total at most 500 characters.",
    ),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  // Unanswered declarations stay null; neither the browser nor an AI may guess.
  madeForKids: z.boolean().nullable().default(null),
  containsSyntheticMedia: z.boolean().nullable().default(null),
});
export type SocialYouTubeSettings = z.infer<typeof socialYouTubeSettingsSchema>;

export const YOUTUBE_THUMBNAIL_MAX_BYTES = 50 * 1024 * 1024;
export const YOUTUBE_THUMBNAIL_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
] as const;

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
