import type { ContentPlatform } from "@/db/schema";

/**
 * Display names for every destination the app knows about.
 *
 * Deliberately its own module with no `server-only` and no database import:
 * client components (the post composer's per-platform previews, the idea cards,
 * the connection rows) all need these labels, and reaching for them through a
 * server module drags `db/drizzle` into the browser bundle.
 *
 * This is the single definition — `lib/titles/title-view.ts` re-exports it for
 * the server-side callers that already import it from there.
 */
export const CONTENT_PLATFORM_LABELS: Record<ContentPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};
