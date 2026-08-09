import "server-only";

import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingBrandContextSnapshots,
  marketingContentItems,
  marketingContentReviewEvents,
  marketingContentRevisions,
  marketingGenerationRuns,
  socialPostTargets,
} from "@/db/schema";
import {
  calculateMarketingQualityMetrics,
  type MarketingQualityMetrics,
} from "@/lib/marketing/metrics/quality-metrics";

const MAX_COHORT_ITEMS = 5_000;

export type MarketingQualityPeriod = {
  from: Date;
  to: Date;
  metrics: MarketingQualityMetrics;
  truncated: boolean;
};

export async function loadMarketingQualityPeriod(input: {
  workspaceId: string;
  from: Date;
  to: Date;
}): Promise<MarketingQualityPeriod> {
  const database = getDatabase();
  const rows = await database
    .select({
      id: marketingContentItems.id,
      createdAt: marketingContentItems.createdAt,
      sourceRunId: marketingContentItems.sourceRunId,
      currentText: marketingContentItems.bodyPlainText,
      costCents: marketingGenerationRuns.actualCostCents,
      model: marketingGenerationRuns.model,
      promptVersion: marketingGenerationRuns.promptVersion,
      skillKey: marketingGenerationRuns.skillKey,
      skillVersion: marketingGenerationRuns.skillVersion,
      contextVersion: marketingBrandContextSnapshots.contextVersion,
    })
    .from(marketingContentItems)
    .leftJoin(
      marketingGenerationRuns,
      and(
        eq(marketingGenerationRuns.id, marketingContentItems.sourceRunId),
        eq(marketingGenerationRuns.workspaceId, input.workspaceId),
      ),
    )
    .leftJoin(
      marketingBrandContextSnapshots,
      and(
        eq(
          marketingBrandContextSnapshots.sourceFingerprint,
          marketingGenerationRuns.brandContextFingerprint,
        ),
        eq(marketingBrandContextSnapshots.workspaceId, input.workspaceId),
      ),
    )
    .where(
      and(
        eq(marketingContentItems.workspaceId, input.workspaceId),
        gte(marketingContentItems.createdAt, input.from),
        lt(marketingContentItems.createdAt, input.to),
      ),
    )
    .limit(MAX_COHORT_ITEMS + 1);
  const truncated = rows.length > MAX_COHORT_ITEMS;
  const cohort = rows.slice(0, MAX_COHORT_ITEMS);
  const ids = cohort.map((row) => row.id);
  if (ids.length === 0)
    return {
      from: input.from,
      to: input.to,
      truncated,
      metrics: calculateMarketingQualityMetrics({
        items: [],
        reviews: [],
        revisions: [],
        publications: [],
      }),
    };
  const [reviews, revisions, publications] = await Promise.all([
    database
      .select({
        contentItemId: marketingContentReviewEvents.contentItemId,
        decision: marketingContentReviewEvents.decision,
        reason: marketingContentReviewEvents.reason,
        createdAt: marketingContentReviewEvents.createdAt,
      })
      .from(marketingContentReviewEvents)
      .where(
        and(
          eq(marketingContentReviewEvents.workspaceId, input.workspaceId),
          inArray(marketingContentReviewEvents.contentItemId, ids),
        ),
      ),
    database
      .select({
        contentItemId: marketingContentRevisions.contentItemId,
        revisionNumber: marketingContentRevisions.revisionNumber,
        changeSource: marketingContentRevisions.changeSource,
        bodyPlainText: marketingContentRevisions.bodyPlainText,
        structuredPayload: marketingContentRevisions.structuredPayload,
      })
      .from(marketingContentRevisions)
      .where(
        and(
          eq(marketingContentRevisions.workspaceId, input.workspaceId),
          inArray(marketingContentRevisions.contentItemId, ids),
        ),
      ),
    database
      .select({
        contentItemId: marketingContentItems.id,
        platform: socialPostTargets.platform,
        status: socialPostTargets.status,
      })
      .from(marketingContentItems)
      .innerJoin(
        socialPostTargets,
        and(
          eq(socialPostTargets.postId, marketingContentItems.socialPostId),
          eq(socialPostTargets.workspaceId, input.workspaceId),
        ),
      )
      .where(
        and(
          eq(marketingContentItems.workspaceId, input.workspaceId),
          inArray(marketingContentItems.id, ids),
          inArray(socialPostTargets.status, ["published", "failed"]),
        ),
      ),
  ]);
  return {
    from: input.from,
    to: input.to,
    truncated,
    metrics: calculateMarketingQualityMetrics({
      items: cohort.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        sourceRunId: row.sourceRunId,
        currentText: row.currentText,
        costCents: row.costCents ?? 0,
        model: row.model ?? "",
        promptVersion: row.promptVersion ?? "",
        skillKey: row.skillKey ?? "",
        skillVersion: row.skillVersion ?? 1,
        contextVersion: row.contextVersion,
      })),
      reviews,
      revisions,
      publications: publications.map((row) => ({
        ...row,
        status: row.status === "published" ? "published" : "failed",
      })),
    }),
  };
}

export async function loadMarketingQualityComparison(input: {
  workspaceId: string;
  current: { from: Date; to: Date };
  previous: { from: Date; to: Date };
}) {
  const [current, previous] = await Promise.all([
    loadMarketingQualityPeriod({
      workspaceId: input.workspaceId,
      ...input.current,
    }),
    loadMarketingQualityPeriod({
      workspaceId: input.workspaceId,
      ...input.previous,
    }),
  ]);
  return { current, previous };
}
