import type { ContentPlatform, ProjectAspectRatio } from "@/db/schema";

const MAX_PROJECT_NAME_LENGTH = 100;

/**
 * Derive a project-name suggestion from an idea's topic, kept within the
 * project name's character limit. Truncates at a word boundary when the topic
 * is a full sentence; always editable afterward.
 */
export function suggestProjectNameFromTopic(topic: string): string {
  const trimmed = topic.trim();
  if (trimmed === "") return "";
  if (trimmed.length <= MAX_PROJECT_NAME_LENGTH) return trimmed;
  const budget = MAX_PROJECT_NAME_LENGTH - 1;
  const truncated = trimmed.slice(0, budget);
  const lastSpace = truncated.lastIndexOf(" ");
  const base = lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated;
  return `${base.trim()}…`;
}

/**
 * Suggest a project aspect ratio for an idea's primary platform: vertical for
 * short-form-first platforms, landscape otherwise. A heuristic default only —
 * the aspect-ratio field stays freely editable.
 */
export function suggestAspectRatioForPlatform(
  platform: ContentPlatform,
): ProjectAspectRatio {
  return platform === "tiktok" || platform === "instagram" ? "9:16" : "16:9";
}
