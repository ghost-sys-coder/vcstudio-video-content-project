import type { MarketingContentStatus } from "@/db/schema";

const transitions = {
  draft: ["needs_review", "archived"],
  needs_review: ["approved", "changes_requested", "archived"],
  changes_requested: ["needs_review", "archived"],
  approved: ["scheduled", "archived"],
  scheduled: ["published", "failed"],
  published: [],
  archived: [],
  failed: ["needs_review", "archived"],
} as const satisfies Record<
  MarketingContentStatus,
  readonly MarketingContentStatus[]
>;

export function canTransitionMarketingContent(
  from: MarketingContentStatus,
  to: MarketingContentStatus,
): boolean {
  return (transitions[from] as readonly MarketingContentStatus[]).includes(to);
}

export function assertMarketingContentTransition(
  from: MarketingContentStatus,
  to: MarketingContentStatus,
): void {
  if (!canTransitionMarketingContent(from, to))
    throw new Error(`MARKETING_CONTENT_TRANSITION_INVALID:${from}:${to}`);
}
