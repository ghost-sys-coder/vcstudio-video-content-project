import type {
  ProductionStage,
  ReleaseState,
} from "@/lib/production/production-readiness";
import type {
  ProductionQueueAttentionFilter,
  ProductionQueueReleaseFilter,
} from "@/lib/production/production-queue-filters";

/** Presentation labels, kept out of components so they can be asserted. */

export const PRODUCTION_STAGE_LABELS: Record<ProductionStage, string> = {
  script: "Script",
  scenes: "Scenes",
  storyboard: "Storyboard",
  audio: "Audio",
  render: "Render",
  release: "Release",
};

/**
 * Release wording deliberately never says "complete". Each state describes what
 * has actually happened, so a scheduled video cannot read as a finished one.
 */
export const RELEASE_STATE_LABELS: Record<ReleaseState, string> = {
  unpublished: "Not scheduled",
  scheduled: "Scheduled",
  rendered: "Rendered",
  published: "Published",
};

export const RELEASE_FILTER_LABELS: Record<
  ProductionQueueReleaseFilter,
  string
> = {
  all: "Every release state",
  unpublished: "Not scheduled",
  scheduled: "Scheduled",
  rendered: "Rendered",
  published: "Published",
};

export const ATTENTION_FILTER_LABELS: Record<
  ProductionQueueAttentionFilter,
  string
> = {
  all: "Everything",
  blocked: "Blocked",
  awaiting_review: "Awaiting review",
};

/** A stable, locale-independent day label for a planned release. */
export function formatPlannedRelease(value: Date | null): string {
  if (!value) return "No date set";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

/** Builds a queue URL that preserves the filters already applied. */
export function buildProductionQueueHref(input: {
  page?: number;
  channelProfileId?: string | null;
  release?: ProductionQueueReleaseFilter;
  attention?: ProductionQueueAttentionFilter;
}): string {
  const params = new URLSearchParams();
  if (input.channelProfileId)
    params.set("channelProfileId", input.channelProfileId);
  if (input.release && input.release !== "all")
    params.set("release", input.release);
  if (input.attention && input.attention !== "all")
    params.set("attention", input.attention);
  if (input.page && input.page > 1) params.set("page", String(input.page));
  const query = params.toString();
  return query ? `/app/queue?${query}` : "/app/queue";
}
