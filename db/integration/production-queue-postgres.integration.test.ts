import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createChannelProfile } from "@/db/commands/channel-profile-commands";
import { createProject } from "@/db/commands/create-project.command";
import { setProjectPlannedRelease } from "@/db/commands/planned-release-commands";
import { getDatabase } from "@/db/drizzle";
import { loadProductionQueue } from "@/db/repositories/production-queue.repository";
import {
  projectScriptVersions,
  projects,
  sceneAnalysisRuns,
  scenes,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { productionQueueQuerySchema } from "@/lib/schemas/production-queue";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

type Fixture = { userId: string; workspaceId: string };

const query = (overrides: Record<string, unknown> = {}) =>
  productionQueueQuerySchema.parse(overrides);

async function createFixture(): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const label = randomUUID();
  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);
  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `queue-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Queue Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Queue Workspace",
      slug: `queue-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
  ]);
  return { userId, workspaceId };
}

async function makeProject(
  fixture: Fixture,
  input: { name: string; channelProfileId?: string | null } = {
    name: "Queue project",
  },
) {
  return createProject({
    workspaceId: fixture.workspaceId,
    userId: fixture.userId,
    name: input.name,
    description: "",
    aspectRatio: "16:9",
    framesPerSecond: 30,
    language: "en",
    maximumBudgetCents: 1_000,
    channelProfileId: input.channelProfileId ?? null,
  });
}

/** Gives a project an approved script and the scenes derived from it. */
async function addApprovedScriptAndScenes(input: {
  fixture: Fixture;
  projectId: string;
  sceneCount: number;
  scenesInReview?: number;
}): Promise<void> {
  const database = getDatabase();
  const scriptVersionId = randomUUID();
  const analysisRunId = randomUUID();
  const label = randomUUID();
  const now = new Date();
  await database.batch([
    database.insert(projectScriptVersions).values({
      id: scriptVersionId,
      workspaceId: input.fixture.workspaceId,
      projectId: input.projectId,
      versionNumber: 1,
      content: "A queue integration narration.",
      characterCount: 30,
      estimatedNarrationDurationSeconds: 5,
      createdByUserId: input.fixture.userId,
      status: "approved",
      approvedByUserId: input.fixture.userId,
      approvedAt: now,
    }),
    database.insert(sceneAnalysisRuns).values({
      id: analysisRunId,
      workspaceId: input.fixture.workspaceId,
      projectId: input.projectId,
      scriptVersionId,
      requestedByUserId: input.fixture.userId,
      idempotencyKey: `queue-analysis-${label}`,
      requestFingerprint: label.replaceAll("-", ""),
      model: "integration-test-model",
      promptVersion: "integration-v1",
      finalPrompt: "Queue fixture analysis prompt.",
      status: "completed",
      progressPercent: 100,
      estimatedCostCents: 1,
      actualCostCents: 1,
      attemptCount: 1,
      startedAt: now,
      completedAt: now,
    }),
  ]);

  const inReview = input.scenesInReview ?? 0;
  await database.insert(scenes).values(
    Array.from({ length: input.sceneCount }, (_, index) => ({
      id: randomUUID(),
      workspaceId: input.fixture.workspaceId,
      projectId: input.projectId,
      scriptVersionId,
      analysisRunId,
      sceneNumber: index + 1,
      status: index < inReview ? ("review" as const) : ("approved" as const),
      currentVersion: 1,
    })),
  );
}

async function cleanup(): Promise<void> {
  const database = getDatabase();
  if (fixtureWorkspaceIds.size)
    await database
      .delete(workspaces)
      .where(inArray(workspaces.id, [...fixtureWorkspaceIds]));
  if (fixtureUserIds.size)
    await database.delete(users).where(inArray(users.id, [...fixtureUserIds]));
  fixtureWorkspaceIds.clear();
  fixtureUserIds.clear();
}

describeDatabase("production queue (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanup();
  });

  it(
    "never returns another workspace's projects",
    { timeout: 90_000 },
    async () => {
      const own = await createFixture();
      const other = await createFixture();
      const mine = await makeProject(own, { name: "Mine" });
      await makeProject(other, { name: "Theirs" });

      const page = await loadProductionQueue({
        workspaceId: own.workspaceId,
        query: query(),
      });
      expect(page.items.map((item) => item.name)).toEqual(["Mine"]);
      expect(page.items[0]?.projectId).toBe(mine.id);
      expect(page.total).toBe(1);
    },
  );

  it(
    "derives readiness from output, not from a hand-set project status",
    { timeout: 90_000 },
    async () => {
      // The acceptance guarantee that matters most here: project settings can
      // set `status` to completed, and that must not make an empty project
      // look ready. Readiness is recomputed from what actually exists.
      const fixture = await createFixture();
      const project = await makeProject(fixture, { name: "Mislabelled" });
      await getDatabase()
        .update(projects)
        .set({ status: "completed" })
        .where(inArray(projects.id, [project.id]));

      const page = await loadProductionQueue({
        workspaceId: fixture.workspaceId,
        query: query(),
      });
      const item = page.items.find((row) => row.projectId === project.id);
      expect(item?.editorialStatus).toBe("completed");
      expect(item?.readiness.isComplete).toBe(false);
      expect(item?.readiness.releaseState).toBe("unpublished");
      expect(item?.readiness.blockers[0]?.kind).toBe("script_missing");
      expect(item?.readiness.nextAction?.href).toBe("script");
    },
  );

  it(
    "counts real scenes and outstanding reviews for the project",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const project = await makeProject(fixture, { name: "With scenes" });
      await addApprovedScriptAndScenes({
        fixture,
        projectId: project.id,
        sceneCount: 4,
        scenesInReview: 3,
      });

      const page = await loadProductionQueue({
        workspaceId: fixture.workspaceId,
        query: query(),
      });
      const item = page.items.find((row) => row.projectId === project.id);
      expect(item?.readiness.stage).toBe("scenes");
      const review = item?.readiness.reviews.find(
        (entry) => entry.kind === "scenes_awaiting_review",
      );
      expect(review?.count).toBe(3);
      expect(review?.message).toBe("3 scenes awaiting review");
      // Four scenes exist and none has imagery yet, so that shortfall shows.
      expect(item?.readiness.blockers.map((entry) => entry.kind)).toContain(
        "images_missing",
      );
    },
  );

  it(
    "treats a planned release as intent, never as progress",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const project = await makeProject(fixture, { name: "Scheduled" });
      await setProjectPlannedRelease({
        workspaceId: fixture.workspaceId,
        projectId: project.id,
        plannedReleaseAt: new Date("2026-12-01T00:00:00.000Z"),
      });

      const page = await loadProductionQueue({
        workspaceId: fixture.workspaceId,
        query: query(),
      });
      const item = page.items.find((row) => row.projectId === project.id);
      expect(item?.plannedReleaseAt?.toISOString()).toBe(
        "2026-12-01T00:00:00.000Z",
      );
      expect(item?.readiness.releaseState).toBe("scheduled");
      // Scheduling it did not advance it or clear its blockers.
      expect(item?.readiness.isComplete).toBe(false);
      expect(item?.readiness.stage).toBe("script");
    },
  );

  it(
    "refuses to set a release date through the wrong workspace",
    { timeout: 90_000 },
    async () => {
      const own = await createFixture();
      const other = await createFixture();
      const project = await makeProject(own, { name: "Scoped" });
      await expect(
        setProjectPlannedRelease({
          workspaceId: other.workspaceId,
          projectId: project.id,
          plannedReleaseAt: new Date("2026-12-01T00:00:00.000Z"),
        }),
      ).rejects.toBeTruthy();
    },
  );

  it(
    "filters by channel and by release state",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const channel = await createChannelProfile({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        values: {
          name: "Finance channel",
          platform: "youtube",
          description: "",
          audienceDescription: "",
          toneDescription: "",
          language: "en",
          cadence: "weekly",
          timeZone: "UTC",
          defaultAspectRatio: null,
          defaultMaximumBudgetCents: null,
          externalAccountId: null,
        },
      });
      const onChannel = await makeProject(fixture, {
        name: "On channel",
        channelProfileId: channel.id,
      });
      await makeProject(fixture, { name: "Off channel" });
      await setProjectPlannedRelease({
        workspaceId: fixture.workspaceId,
        projectId: onChannel.id,
        plannedReleaseAt: new Date("2026-11-01T00:00:00.000Z"),
      });

      const byChannel = await loadProductionQueue({
        workspaceId: fixture.workspaceId,
        query: query({ channelProfileId: channel.id }),
      });
      expect(byChannel.items.map((item) => item.name)).toEqual(["On channel"]);
      expect(byChannel.items[0]?.channelName).toBe("Finance channel");

      const scheduled = await loadProductionQueue({
        workspaceId: fixture.workspaceId,
        query: query({ release: "scheduled" }),
      });
      expect(scheduled.items.map((item) => item.name)).toEqual(["On channel"]);

      const published = await loadProductionQueue({
        workspaceId: fixture.workspaceId,
        query: query({ release: "published" }),
      });
      expect(published.items).toHaveLength(0);
    },
  );

  it(
    "keeps every page bounded by the requested size",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      for (const name of ["A", "B", "C"]) await makeProject(fixture, { name });

      const first = await loadProductionQueue({
        workspaceId: fixture.workspaceId,
        query: query({ pageSize: "2" }),
      });
      expect(first.items).toHaveLength(2);
      expect(first.total).toBe(3);
      expect(first.pageCount).toBe(2);

      const second = await loadProductionQueue({
        workspaceId: fixture.workspaceId,
        query: query({ pageSize: "2", page: "2" }),
      });
      expect(second.items).toHaveLength(1);

      // The two pages together cover the workspace exactly once.
      const names = [...first.items, ...second.items].map((item) => item.name);
      expect(names.sort()).toEqual(["A", "B", "C"]);
    },
  );
});
