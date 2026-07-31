import type { ContentPlatform } from "@/db/schema";

/**
 * Background treatment behind each platform's mark, keyed exhaustively so a new
 * `content_platform` value cannot silently inherit another brand's colour.
 *
 * Client-safe: no `server-only`, no database import — connection cards render in
 * the browser.
 */
export const PLATFORM_BRAND_BACKGROUND_CLASS: Record<ContentPlatform, string> =
  {
    youtube: "bg-[#e60000]",
    facebook: "bg-[#1877f2]",
    instagram: "bg-linear-to-br from-[#833ab4] via-[#e1306c] to-[#f77737]",
    linkedin: "bg-[#0a66c2]",
    tiktok: "bg-black",
  };
