import type { MarketingAutonomyLevel } from "@/db/schema";

/**
 * User-facing names for the autonomy ladder.
 *
 * Client-safe (no database import beyond the type), so both the settings form
 * and the Home summary read the same words. See
 * `docs/marketing/09-automation.md` for what each level actually permits.
 */
export const AUTONOMY_LEVEL_LABELS = {
  manual: "Manual",
  assisted: "Assisted",
  autonomous: "Autonomous",
} as const satisfies Record<MarketingAutonomyLevel, string>;

export const AUTONOMY_LEVEL_DESCRIPTIONS = {
  manual:
    "Nothing happens unless you ask. Every draft waits for your approval and you publish it yourself.",
  assisted:
    "Schedule rules draft content on their own. You still approve everything; approved items publish themselves at their scheduled time.",
  autonomous:
    "The studio approves its own work within caps and reports weekly. Not available yet.",
} as const satisfies Record<MarketingAutonomyLevel, string>;
