import "server-only";

import type { MarketingGenerationRun } from "@/db/schema";
import {
  getMarketingSpendByOperation,
  listMarketingRuns,
} from "@/db/repositories/marketing-usage.repository";
import { getMarketingCommittedSpend } from "@/lib/budgets/committed-spend";
import { loadMarketingSettings } from "@/lib/marketing/marketing-settings-view";

export const MARKETING_RECENT_RUN_COUNT = 10;

export type MarketingUsageView = {
  monthToDateCents: number;
  /** Null when the workspace has set no marketing sub-cap. */
  monthlyBudgetCents: number | null;
  byOperation: { operation: string; committedCents: number; runs: number }[];
  recentRuns: MarketingGenerationRun[];
};

function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * The marketing rollup for `/app/usage`.
 *
 * Shown beside the pipeline figures rather than merged into them. Both draw on
 * the same workspace budget, and a single combined number would hide which side
 * consumed it — which is exactly the question somebody opens this page to
 * answer when a generation is refused.
 */
export async function loadMarketingUsageView(input: {
  workspaceId: string;
  now?: Date;
}): Promise<MarketingUsageView> {
  const since = startOfMonth(input.now ?? new Date());

  const [monthToDateCents, settings, byOperation, recentRuns] =
    await Promise.all([
      getMarketingCommittedSpend({ workspaceId: input.workspaceId, since }),
      loadMarketingSettings({ workspaceId: input.workspaceId }),
      getMarketingSpendByOperation({ workspaceId: input.workspaceId, since }),
      listMarketingRuns({
        workspaceId: input.workspaceId,
        limit: MARKETING_RECENT_RUN_COUNT,
      }),
    ]);

  return {
    monthToDateCents,
    monthlyBudgetCents: settings.monthlyMarketingBudgetCents,
    byOperation: [...byOperation].sort(
      (left, right) => right.committedCents - left.committedCents,
    ),
    recentRuns,
  };
}
