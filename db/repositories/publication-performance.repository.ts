import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingBrandContextSnapshots,
  marketingContentItems,
  marketingGenerationRuns,
  platformConnections,
  publicationMetricObservations,
  publicationPerformanceSources,
  socialPosts,
  socialPostTargets,
  videoPublications,
  type ContentPlatform,
  type PerformanceMetricKind,
  type PublicationPerformanceSource,
} from "@/db/schema";
import type { PerformanceObservation } from "@/lib/marketing/performance/performance-metrics";

const SYNC_BATCH_SIZE = 50;
const DASHBOARD_OBSERVATION_LIMIT = 5_000;

function hookFrom(text: string): string | null {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return normalized.slice(0, 180);
}

/** Discover published destinations and freeze decision attribution once. */
export async function discoverPerformanceSources(): Promise<number> {
  const database = getDatabase();
  const [social, videos] = await Promise.all([
    database
      .select({
        targetId: socialPostTargets.id,
        workspaceId: socialPostTargets.workspaceId,
        connectionId: socialPostTargets.connectionId,
        platform: socialPostTargets.platform,
        externalId: socialPostTargets.externalPostId,
        publishedAt: socialPostTargets.publishedAt,
        body: socialPostTargets.overrideBodyPlainText,
        sharedBody: socialPosts.bodyPlainText,
        sourceRunId: marketingContentItems.sourceRunId,
        promptVersion: marketingGenerationRuns.promptVersion,
        contextVersion: marketingBrandContextSnapshots.contextVersion,
      })
      .from(socialPostTargets)
      .innerJoin(socialPosts, eq(socialPosts.id, socialPostTargets.postId))
      .leftJoin(
        marketingContentItems,
        eq(marketingContentItems.socialPostId, socialPosts.id),
      )
      .leftJoin(
        marketingGenerationRuns,
        eq(marketingGenerationRuns.id, marketingContentItems.sourceRunId),
      )
      .leftJoin(
        marketingBrandContextSnapshots,
        and(
          eq(
            marketingBrandContextSnapshots.sourceFingerprint,
            marketingGenerationRuns.brandContextFingerprint,
          ),
          eq(
            marketingBrandContextSnapshots.workspaceId,
            socialPostTargets.workspaceId,
          ),
        ),
      )
      .where(
        and(
          eq(socialPostTargets.status, "published"),
          isNotNull(socialPostTargets.externalPostId),
          isNotNull(socialPostTargets.publishedAt),
          sql`not exists (select 1 from publication_performance_sources existing where existing.social_post_target_id = ${socialPostTargets.id})`,
        ),
      )
      .limit(SYNC_BATCH_SIZE),
    database
      .select({
        publicationId: videoPublications.id,
        workspaceId: videoPublications.workspaceId,
        connectionId: videoPublications.connectionId,
        platform: videoPublications.platform,
        externalId: videoPublications.externalVideoId,
        publishedAt: videoPublications.completedAt,
        title: videoPublications.title,
        caption: videoPublications.caption,
      })
      .from(videoPublications)
      .where(
        and(
          eq(videoPublications.status, "succeeded"),
          isNotNull(videoPublications.externalVideoId),
          isNotNull(videoPublications.completedAt),
          sql`not exists (select 1 from publication_performance_sources existing where existing.video_publication_id = ${videoPublications.id})`,
        ),
      )
      .limit(SYNC_BATCH_SIZE),
  ]);
  let discovered = 0;
  for (const row of social) {
    if (!row.externalId || !row.publishedAt) continue;
    const body = row.body ?? row.sharedBody;
    const inserted = await database
      .insert(publicationPerformanceSources)
      .values({
        workspaceId: row.workspaceId,
        publicationKind: "social_post_target",
        socialPostTargetId: row.targetId,
        connectionId: row.connectionId,
        platform: row.platform,
        providerPublicationId: row.externalId,
        providerDefinitionVersion: "discovered-v1",
        syncStatus: row.platform === "youtube" ? "ready" : "unsupported",
        nextSyncAt: row.platform === "youtube" ? new Date() : null,
        safeErrorMessage:
          row.platform === "youtube"
            ? null
            : "Analytics synchronization is not enabled for this provider grant.",
        attribution: {
          titleOrCaption: body,
          thumbnailAssetId: null,
          hook: hookFrom(body),
          format: "social_post",
          promptVersion: row.sourceRunId ? row.promptVersion : null,
          contextVersion: row.sourceRunId ? row.contextVersion : null,
          publishedAt: row.publishedAt.toISOString(),
        },
      })
      .onConflictDoNothing()
      .returning({ id: publicationPerformanceSources.id });
    discovered += inserted.length;
  }
  for (const row of videos) {
    if (!row.externalId || !row.publishedAt) continue;
    const text = row.caption ?? row.title;
    const inserted = await database
      .insert(publicationPerformanceSources)
      .values({
        workspaceId: row.workspaceId,
        publicationKind: "video_publication",
        videoPublicationId: row.publicationId,
        connectionId: row.connectionId,
        platform: row.platform,
        providerPublicationId: row.externalId,
        providerDefinitionVersion: "discovered-v1",
        syncStatus: row.platform === "youtube" ? "ready" : "unsupported",
        nextSyncAt: row.platform === "youtube" ? new Date() : null,
        safeErrorMessage:
          row.platform === "youtube"
            ? null
            : "Analytics synchronization is not enabled for this provider grant.",
        attribution: {
          titleOrCaption: text,
          thumbnailAssetId: null,
          hook: hookFrom(text),
          format: "video",
          promptVersion: null,
          contextVersion: null,
          publishedAt: row.publishedAt.toISOString(),
        },
      })
      .onConflictDoNothing()
      .returning({ id: publicationPerformanceSources.id });
    discovered += inserted.length;
  }
  return discovered;
}

export type DuePerformanceSource = PublicationPerformanceSource & {
  connectionStatus: string | null;
  accessTokenSealed: string | null;
};

export async function listDuePerformanceSources(
  now: Date,
): Promise<DuePerformanceSource[]> {
  return getDatabase()
    .select({
      source: publicationPerformanceSources,
      connectionStatus: platformConnections.status,
      accessTokenSealed: platformConnections.accessTokenSealed,
    })
    .from(publicationPerformanceSources)
    .leftJoin(
      platformConnections,
      and(
        eq(platformConnections.id, publicationPerformanceSources.connectionId),
        eq(
          platformConnections.workspaceId,
          publicationPerformanceSources.workspaceId,
        ),
      ),
    )
    .where(
      and(
        inArray(publicationPerformanceSources.syncStatus, [
          "pending",
          "ready",
          "rate_limited",
          "failed",
        ]),
        or(
          lte(publicationPerformanceSources.nextSyncAt, now),
          eq(publicationPerformanceSources.syncStatus, "pending"),
        ),
        or(
          lte(publicationPerformanceSources.backoffUntil, now),
          isNull(publicationPerformanceSources.backoffUntil),
        ),
      ),
    )
    .orderBy(asc(publicationPerformanceSources.nextSyncAt))
    .limit(SYNC_BATCH_SIZE)
    .then((rows) =>
      rows.map(({ source, connectionStatus, accessTokenSealed }) => ({
        ...source,
        connectionStatus,
        accessTokenSealed,
      })),
    );
}

export async function recordPerformanceSync(input: {
  source: PublicationPerformanceSource;
  observations: PerformanceObservation[];
  observedAt: Date;
}): Promise<void> {
  const database = getDatabase();
  for (const observation of input.observations)
    await database
      .insert(publicationMetricObservations)
      .values({
        workspaceId: input.source.workspaceId,
        sourceId: input.source.id,
        ...observation,
        normalizedValue: observation.normalizedValue.toString(),
        observedAt: input.observedAt,
      })
      .onConflictDoNothing();
  await database
    .update(publicationPerformanceSources)
    .set({
      syncStatus: "ready",
      providerDefinitionVersion:
        input.observations[0]?.providerDefinitionVersion ??
        input.source.providerDefinitionVersion,
      lastSyncedAt: input.observedAt,
      nextSyncAt: new Date(input.observedAt.getTime() + 6 * 60 * 60_000),
      backoffUntil: null,
      safeErrorMessage: null,
      updatedAt: input.observedAt,
    })
    .where(eq(publicationPerformanceSources.id, input.source.id));
}

export async function markPerformanceSyncUnavailable(input: {
  sourceId: string;
  status: "permission_required" | "rate_limited" | "failed";
  message: string;
  now: Date;
}): Promise<void> {
  const delay = input.status === "rate_limited" ? 24 : 6;
  await getDatabase()
    .update(publicationPerformanceSources)
    .set({
      syncStatus: input.status,
      safeErrorMessage: input.message,
      attemptCount: sql`${publicationPerformanceSources.attemptCount} + 1`,
      backoffUntil: new Date(input.now.getTime() + delay * 60 * 60_000),
      nextSyncAt: new Date(input.now.getTime() + delay * 60 * 60_000),
      updatedAt: input.now,
    })
    .where(eq(publicationPerformanceSources.id, input.sourceId));
}

export type PerformanceDashboard = {
  sources: number;
  latestTotals: Partial<Record<PerformanceMetricKind, number>>;
  platforms: { platform: ContentPlatform; sources: number; observed: number }[];
  recent: {
    sourceId: string;
    platform: ContentPlatform;
    titleOrCaption: string;
    metricKind: PerformanceMetricKind;
    rawMetricKey: string;
    value: number;
    unit: string;
    comparableGroup: string | null;
    observedAt: Date;
  }[];
};

export async function loadPerformanceDashboard(input: {
  workspaceId: string;
}): Promise<PerformanceDashboard> {
  const database = getDatabase();
  const sources = await database
    .select()
    .from(publicationPerformanceSources)
    .where(eq(publicationPerformanceSources.workspaceId, input.workspaceId))
    .orderBy(desc(publicationPerformanceSources.createdAt))
    .limit(1_000);
  if (sources.length === 0)
    return { sources: 0, latestTotals: {}, platforms: [], recent: [] };
  const observations = await database
    .select()
    .from(publicationMetricObservations)
    .where(eq(publicationMetricObservations.workspaceId, input.workspaceId))
    .orderBy(desc(publicationMetricObservations.observedAt))
    .limit(DASHBOARD_OBSERVATION_LIMIT);
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const latest = new Map<string, (typeof observations)[number]>();
  for (const observation of observations) {
    const key = `${observation.sourceId}:${observation.rawMetricKey}`;
    if (!latest.has(key)) latest.set(key, observation);
  }
  const latestTotals: PerformanceDashboard["latestTotals"] = {};
  for (const observation of latest.values())
    latestTotals[observation.metricKind] =
      (latestTotals[observation.metricKind] ?? 0) +
      Number(observation.normalizedValue);
  const platforms = [...new Set(sources.map((source) => source.platform))].map(
    (platform) => ({
      platform,
      sources: sources.filter((source) => source.platform === platform).length,
      observed: new Set(
        [...latest.values()]
          .filter(
            (observation) =>
              sourceById.get(observation.sourceId)?.platform === platform,
          )
          .map((observation) => observation.sourceId),
      ).size,
    }),
  );
  return {
    sources: sources.length,
    latestTotals,
    platforms,
    recent: [...latest.values()].slice(0, 50).flatMap((observation) => {
      const source = sourceById.get(observation.sourceId);
      return source
        ? [
            {
              sourceId: source.id,
              platform: source.platform,
              titleOrCaption: source.attribution.titleOrCaption,
              metricKind: observation.metricKind,
              rawMetricKey: observation.rawMetricKey,
              value: Number(observation.normalizedValue),
              unit: observation.unit,
              comparableGroup: observation.comparableGroup,
              observedAt: observation.observedAt,
            },
          ]
        : [];
    }),
  };
}
