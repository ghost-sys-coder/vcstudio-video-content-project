import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { disconnectPlatformConnection } from "@/db/commands/platform-connection-commands";
import { getDatabase } from "@/db/drizzle";
import { loadPerformanceDashboard } from "@/db/repositories/publication-performance.repository";
import {
  platformConnections,
  publicationMetricObservations,
  publicationPerformanceSources,
  socialPosts,
  socialPostTargets,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;
const fixture = {
  userId: randomUUID(),
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  connectionId: randomUUID(),
  postId: randomUUID(),
  targetId: randomUUID(),
  sourceId: randomUUID(),
};

describeDatabase("publication performance PostgreSQL", () => {
  it("preserves observations after disconnect and rejects cross-workspace attribution", async () => {
    const database = getDatabase();
    const now = new Date("2026-08-10T09:00:00Z");
    await database.batch([
      database.insert(users).values({
        id: fixture.userId,
        clerkUserId: `performance-${fixture.userId}`,
        email: `${fixture.userId}@integration.invalid`,
        displayName: "Performance Fixture",
      }),
      database.insert(workspaces).values([
        {
          id: fixture.workspaceId,
          name: "Performance",
          slug: `performance-${fixture.workspaceId}`,
          createdByUserId: fixture.userId,
        },
        {
          id: fixture.otherWorkspaceId,
          name: "Other Performance",
          slug: `other-performance-${fixture.otherWorkspaceId}`,
          createdByUserId: fixture.userId,
        },
      ]),
      database.insert(workspaceMembers).values([
        {
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          role: "owner",
        },
        {
          workspaceId: fixture.otherWorkspaceId,
          userId: fixture.userId,
          role: "owner",
        },
      ]),
      database.insert(platformConnections).values({
        id: fixture.connectionId,
        workspaceId: fixture.workspaceId,
        platform: "youtube",
        externalAccountId: "channel-fixture",
        externalAccountName: "Fixture channel",
        accessTokenSealed: "sealed-fixture",
        scopes: "youtube.readonly",
        connectedByUserId: fixture.userId,
      }),
      database.insert(socialPosts).values({
        id: fixture.postId,
        workspaceId: fixture.workspaceId,
        name: "Performance post",
        bodyPlainText: "A measurable hook",
        status: "published",
        createdByUserId: fixture.userId,
      }),
    ]);
    await database.insert(socialPostTargets).values({
      id: fixture.targetId,
      postId: fixture.postId,
      workspaceId: fixture.workspaceId,
      platform: "youtube",
      connectionId: fixture.connectionId,
      status: "published",
      externalPostId: "video-fixture",
      idempotencyKey: `performance:${fixture.targetId}`,
      publishedAt: now,
    });
    await database.insert(publicationPerformanceSources).values({
      id: fixture.sourceId,
      workspaceId: fixture.workspaceId,
      publicationKind: "social_post_target",
      socialPostTargetId: fixture.targetId,
      connectionId: fixture.connectionId,
      platform: "youtube",
      providerPublicationId: "video-fixture",
      providerDefinitionVersion: "youtube-data-v3-test",
      syncStatus: "ready",
      attribution: {
        titleOrCaption: "A measurable hook",
        thumbnailAssetId: null,
        hook: "A measurable hook",
        format: "social_post",
        promptVersion: "test-v1",
        contextVersion: 1,
        publishedAt: now.toISOString(),
      },
    });
    await database.insert(publicationMetricObservations).values({
      workspaceId: fixture.workspaceId,
      sourceId: fixture.sourceId,
      metricKind: "views",
      unit: "count",
      normalizedValue: "42",
      rawMetricKey: "viewCount",
      rawValue: "42",
      providerDefinition: "Test lifetime views.",
      providerDefinitionVersion: "youtube-data-v3-test",
      comparableGroup: "video_starts_or_views",
      observedAt: now,
    });
    await expect(
      database.insert(publicationMetricObservations).values({
        workspaceId: fixture.otherWorkspaceId,
        sourceId: fixture.sourceId,
        metricKind: "views",
        unit: "count",
        normalizedValue: "1",
        rawMetricKey: "viewCount",
        rawValue: "1",
        providerDefinition: "Invalid foreign observation.",
        providerDefinitionVersion: "test",
        observedAt: now,
      }),
    ).rejects.toThrow();
    await disconnectPlatformConnection({
      connectionId: fixture.connectionId,
      workspaceId: fixture.workspaceId,
    });
    const own = await loadPerformanceDashboard({
      workspaceId: fixture.workspaceId,
    });
    const other = await loadPerformanceDashboard({
      workspaceId: fixture.otherWorkspaceId,
    });
    expect(own).toMatchObject({ sources: 1, latestTotals: { views: 42 } });
    expect(other.sources).toBe(0);
  }, 20_000);
});

afterAll(async () => {
  if (!enabled) return;
  const database = getDatabase();
  await database
    .delete(workspaces)
    .where(eq(workspaces.id, fixture.workspaceId));
  await database
    .delete(workspaces)
    .where(eq(workspaces.id, fixture.otherWorkspaceId));
  await database.delete(users).where(eq(users.id, fixture.userId));
});
