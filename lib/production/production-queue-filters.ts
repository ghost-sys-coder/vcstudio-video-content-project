/**
 * The queue's filter vocabulary, kept free of Zod so client components can
 * import the types without pulling a validator into the browser bundle. The
 * request schema builds its enums from these same lists.
 */

export const PRODUCTION_QUEUE_RELEASE_FILTERS = [
  "all",
  "unpublished",
  "scheduled",
  "rendered",
  "published",
] as const;

export const PRODUCTION_QUEUE_ATTENTION_FILTERS = [
  "all",
  "blocked",
  "awaiting_review",
] as const;

export type ProductionQueueReleaseFilter =
  (typeof PRODUCTION_QUEUE_RELEASE_FILTERS)[number];

export type ProductionQueueAttentionFilter =
  (typeof PRODUCTION_QUEUE_ATTENTION_FILTERS)[number];

/** A hard ceiling, so a crafted query string cannot request an unbounded page. */
export const PRODUCTION_QUEUE_MAX_PAGE_SIZE = 50;
export const PRODUCTION_QUEUE_DEFAULT_PAGE_SIZE = 20;
