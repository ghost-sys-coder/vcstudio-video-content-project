import "server-only";

import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  googleBusinessConnections,
  googleBusinessLocations,
  marketingContentItems,
  marketingGenerationRuns,
  marketingScheduleRuleRuns,
  marketingWeeklyDigestAcknowledgements,
  marketingWeeklyDigests,
  platformConnections,
} from "@/db/schema";
import { loadMarketingQualityPeriod } from "@/db/repositories/marketing-quality-metrics.repository";
import {
  buildWeeklyDigestRecommendations,
  type MarketingWeeklyDigestSnapshot,
} from "@/lib/marketing/digests/weekly-digest";

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function generateMarketingWeeklyDigest(input: {
  workspaceId: string;
  weekStart: Date;
  weekEnd: Date;
  now?: Date;
  triggerRunId?: string;
}) {
  const database = getDatabase();
  const now = input.now ?? new Date();
  const existing = await database
    .select({
      id: marketingWeeklyDigests.id,
      status: marketingWeeklyDigests.status,
    })
    .from(marketingWeeklyDigests)
    .where(
      and(
        eq(marketingWeeklyDigests.workspaceId, input.workspaceId),
        eq(marketingWeeklyDigests.weekStart, dateKey(input.weekStart)),
      ),
    )
    .limit(1);
  if (existing[0]?.status === "ready") return existing[0];
  const [digest] = await database
    .insert(marketingWeeklyDigests)
    .values({
      workspaceId: input.workspaceId,
      weekStart: dateKey(input.weekStart),
      weekEnd: dateKey(input.weekEnd),
      triggerRunId: input.triggerRunId,
    })
    .onConflictDoUpdate({
      target: [
        marketingWeeklyDigests.workspaceId,
        marketingWeeklyDigests.weekStart,
      ],
      set: {
        status: "generating",
        triggerRunId: input.triggerRunId,
        updatedAt: now,
      },
    })
    .returning({ id: marketingWeeklyDigests.id });
  if (!digest) throw new Error("MARKETING_WEEKLY_DIGEST_NOT_CLAIMED");

  const [
    quality,
    runs,
    schedules,
    channels,
    google,
    selected,
    upcomingContent,
    upcomingRuns,
  ] = await Promise.all([
    loadMarketingQualityPeriod({
      workspaceId: input.workspaceId,
      from: input.weekStart,
      to: input.weekEnd,
    }),
    database
      .select({
        actualCostCents: sql<number>`coalesce(sum(${marketingGenerationRuns.actualCostCents}), 0)::int`,
        budgetRefusals: sql<number>`count(*) filter (where ${marketingGenerationRuns.errorCategory} in ('budget_exhausted', 'reservation_refused'))::int`,
      })
      .from(marketingGenerationRuns)
      .where(
        and(
          eq(marketingGenerationRuns.workspaceId, input.workspaceId),
          gte(marketingGenerationRuns.createdAt, input.weekStart),
          lt(marketingGenerationRuns.createdAt, input.weekEnd),
        ),
      ),
    database
      .select({
        skipped: sql<number>`count(*) filter (where ${marketingScheduleRuleRuns.status} = 'skipped')::int`,
        failed: sql<number>`count(*) filter (where ${marketingScheduleRuleRuns.status} = 'failed')::int`,
        capRefusals: sql<number>`count(*) filter (where ${marketingScheduleRuleRuns.skipReason} in ('daily_item_cap', 'monthly_rule_budget'))::int`,
      })
      .from(marketingScheduleRuleRuns)
      .where(
        and(
          eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId),
          gte(marketingScheduleRuleRuns.createdAt, input.weekStart),
          lt(marketingScheduleRuleRuns.createdAt, input.weekEnd),
        ),
      ),
    database
      .select({
        connected: sql<number>`count(*) filter (where ${platformConnections.status} = 'active')::int`,
        unhealthy: sql<number>`count(*) filter (where ${platformConnections.status} <> 'active')::int`,
      })
      .from(platformConnections)
      .where(eq(platformConnections.workspaceId, input.workspaceId)),
    database
      .select({
        status: googleBusinessConnections.status,
        syncStatus: googleBusinessConnections.syncStatus,
        lastSyncedAt: googleBusinessConnections.lastSyncedAt,
      })
      .from(googleBusinessConnections)
      .where(eq(googleBusinessConnections.workspaceId, input.workspaceId))
      .limit(1),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(googleBusinessLocations)
      .where(
        and(
          eq(googleBusinessLocations.workspaceId, input.workspaceId),
          eq(googleBusinessLocations.selected, true),
        ),
      ),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(marketingContentItems)
      .where(
        and(
          eq(marketingContentItems.workspaceId, input.workspaceId),
          gte(marketingContentItems.scheduledFor, now),
          lt(
            marketingContentItems.scheduledFor,
            new Date(now.getTime() + 7 * 86_400_000),
          ),
        ),
      ),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(marketingScheduleRuleRuns)
      .where(
        and(
          eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId),
          gte(marketingScheduleRuleRuns.scheduledFor, now),
          lt(
            marketingScheduleRuleRuns.scheduledFor,
            new Date(now.getTime() + 7 * 86_400_000),
          ),
        ),
      ),
  ]);
  const metrics = quality.metrics;
  const published = metrics.publicationByPlatform.reduce(
    (sum, row) => sum + row.published,
    0,
  );
  const publicationFailures = metrics.publicationByPlatform.reduce(
    (sum, row) => sum + row.failed,
    0,
  );
  const googleConnection = google[0];
  const snapshot: MarketingWeeklyDigestSnapshot = {
    activity: {
      generated: metrics.generated,
      reviewed: metrics.reviewed,
      approved: metrics.approved,
      rejected: metrics.rejected,
      published,
      publicationFailures,
      substantiveEditRate: metrics.substantiveEditRate,
      rejectionReasons: metrics.rejectionReasons,
    },
    spend: {
      actualCostCents: runs[0]?.actualCostCents ?? 0,
      budgetRefusals: runs[0]?.budgetRefusals ?? 0,
      capRefusals: schedules[0]?.capRefusals ?? 0,
    },
    scheduler: {
      skipped: schedules[0]?.skipped ?? 0,
      failed: schedules[0]?.failed ?? 0,
    },
    integrations: {
      connectedChannels: channels[0]?.connected ?? 0,
      unhealthyChannels: channels[0]?.unhealthy ?? 0,
      googleBusinessStatus: googleConnection
        ? `${googleConnection.status}:${googleConnection.syncStatus}`
        : "not_connected",
      googleBusinessLastSyncedAt:
        googleConnection?.lastSyncedAt?.toISOString() ?? null,
      selectedGoogleBusinessLocations: selected[0]?.count ?? 0,
    },
    upcoming: {
      scheduledContent: upcomingContent[0]?.count ?? 0,
      scheduleRuns: upcomingRuns[0]?.count ?? 0,
    },
    recommendedActions: buildWeeklyDigestRecommendations({
      generated: metrics.generated,
      reviewed: metrics.reviewed,
      rejected: metrics.rejected,
      schedulerFailures: schedules[0]?.failed ?? 0,
      unhealthyChannels: channels[0]?.unhealthy ?? 0,
      googleBusinessHealthy:
        googleConnection?.status === "active" &&
        googleConnection.syncStatus === "succeeded",
      upcomingScheduledContent: upcomingContent[0]?.count ?? 0,
    }),
  };
  const [ready] = await database
    .update(marketingWeeklyDigests)
    .set({ status: "ready", snapshot, generatedAt: now, updatedAt: now })
    .where(
      and(
        eq(marketingWeeklyDigests.id, digest.id),
        eq(marketingWeeklyDigests.workspaceId, input.workspaceId),
      ),
    )
    .returning();
  if (!ready) throw new Error("MARKETING_WEEKLY_DIGEST_NOT_SAVED");
  return ready;
}

export async function listMarketingWeeklyDigests(input: {
  workspaceId: string;
  userId: string;
  limit?: number;
}) {
  return getDatabase()
    .select({
      digest: marketingWeeklyDigests,
      readAt: marketingWeeklyDigestAcknowledgements.readAt,
      acknowledgedAt: marketingWeeklyDigestAcknowledgements.acknowledgedAt,
    })
    .from(marketingWeeklyDigests)
    .leftJoin(
      marketingWeeklyDigestAcknowledgements,
      and(
        eq(
          marketingWeeklyDigestAcknowledgements.digestId,
          marketingWeeklyDigests.id,
        ),
        eq(
          marketingWeeklyDigestAcknowledgements.workspaceId,
          input.workspaceId,
        ),
        eq(marketingWeeklyDigestAcknowledgements.userId, input.userId),
      ),
    )
    .where(eq(marketingWeeklyDigests.workspaceId, input.workspaceId))
    .orderBy(desc(marketingWeeklyDigests.weekStart))
    .limit(Math.min(input.limit ?? 12, 52));
}
