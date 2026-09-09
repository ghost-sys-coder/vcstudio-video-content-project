import { z } from "zod";
import {
  PRODUCTION_QUEUE_ATTENTION_FILTERS,
  PRODUCTION_QUEUE_DEFAULT_PAGE_SIZE,
  PRODUCTION_QUEUE_MAX_PAGE_SIZE,
  PRODUCTION_QUEUE_RELEASE_FILTERS,
} from "@/lib/production/production-queue-filters";

/**
 * Queue filters. Everything here arrives from the query string, so each field
 * is coerced and bounded rather than trusted, and the page size has a hard
 * ceiling so a crafted URL cannot ask for an unbounded scan. Unknown filter
 * values fall back to "all" instead of failing the page.
 */

/** An empty select value means "no filter", not an invalid channel. */
const optionalChannelId = z
  .string()
  .trim()
  .default("")
  .transform((value) => (value === "" ? null : value))
  .refine(
    (value) => value === null || z.uuid().safeParse(value).success,
    "Select a valid channel.",
  );

export const productionQueueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PRODUCTION_QUEUE_MAX_PAGE_SIZE)
    .catch(PRODUCTION_QUEUE_DEFAULT_PAGE_SIZE)
    .default(PRODUCTION_QUEUE_DEFAULT_PAGE_SIZE),
  channelProfileId: optionalChannelId,
  release: z.enum(PRODUCTION_QUEUE_RELEASE_FILTERS).catch("all").default("all"),
  attention: z
    .enum(PRODUCTION_QUEUE_ATTENTION_FILTERS)
    .catch("all")
    .default("all"),
  /** Archived projects stay out of the queue unless explicitly requested. */
  includeArchived: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((value) => value === true || value === "true"),
});

export type ProductionQueueQuery = z.infer<typeof productionQueueQuerySchema>;

export const setPlannedReleaseSchema = z.object({
  projectId: z.uuid(),
  /** An empty value clears the date, which is how a plan is cancelled. */
  plannedReleaseAt: z
    .string()
    .trim()
    .default("")
    .refine(
      (value) => value === "" || !Number.isNaN(Date.parse(value)),
      "Enter a valid release date.",
    )
    .transform((value) => (value === "" ? null : new Date(value))),
});

export type SetPlannedReleaseInput = z.infer<typeof setPlannedReleaseSchema>;
