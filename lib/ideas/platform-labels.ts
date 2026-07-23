import type { ContentPlatform } from "@/db/schema";

/** Display names for the distribution platforms an idea can target. */
export const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
};

/** Human-readable runtime for an idea's suggested length. */
export function formatDurationLabel(seconds: number | null): string {
  if (seconds === null) return "Flexible length";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}
