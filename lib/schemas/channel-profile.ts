import { z } from "zod";

export const CHANNEL_CADENCES = [
  "weekly",
  "biweekly",
  "monthly",
  "irregular",
] as const;

export const CHANNEL_PROFILE_PLATFORMS = [
  "youtube",
  "tiktok",
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
] as const;

const ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const;

/**
 * IANA zone names only. Release cadence is meaningless without a zone, and a
 * free-text field would quietly accept "EST" and drift by an hour twice a year.
 */
const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (value) => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Provide a valid IANA time zone, for example Europe/London." },
  );

export const channelProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  platform: z.enum(CHANNEL_PROFILE_PLATFORMS),
  description: z.string().trim().max(2000).default(""),
  audienceDescription: z.string().trim().max(2000).default(""),
  toneDescription: z.string().trim().max(1000).default(""),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, "Use a language tag such as en-US."),
  cadence: z.enum(CHANNEL_CADENCES).default("weekly"),
  timeZone: timeZoneSchema.default("UTC"),
  defaultAspectRatio: z.enum(ASPECT_RATIOS).nullable().default(null),
  defaultMaximumBudgetCents: z.coerce
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .nullable()
    .default(null),
  /** The platform's own account id, when the channel has been connected. */
  externalAccountId: z.string().trim().max(200).nullable().default(null),
});

export const createChannelProfileSchema = channelProfileInputSchema;

export const updateChannelProfileSchema = channelProfileInputSchema.extend({
  channelProfileId: z.uuid(),
});

export const archiveChannelProfileSchema = z.object({
  channelProfileId: z.uuid(),
});

export const assignProjectChannelSchema = z.object({
  projectId: z.uuid(),
  /** Empty string clears the assignment; a project may have no channel. */
  channelProfileId: z.union([z.uuid(), z.literal("")]),
});

export type ChannelProfileInput = z.infer<typeof channelProfileInputSchema>;
export type ChannelCadence = (typeof CHANNEL_CADENCES)[number];

/** Stable per-workspace handle. Mirrors the character slug rules. */
export function createChannelProfileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "channel"
  );
}
