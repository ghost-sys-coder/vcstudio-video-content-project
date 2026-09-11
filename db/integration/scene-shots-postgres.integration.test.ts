import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { config } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDatabase } from "@/db/drizzle";
import {
  projects,
  projectScriptVersions,
  sceneAnalysisRuns,
  sceneImageGenerations,
  scenes,
  sceneVersions,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { approveSceneImageGeneration } from "@/db/commands/scene-image-commands";
import { listApprovedSceneImageAssets } from "@/db/repositories/subtitle.repository";
import { shotsBySceneVersion } from "@/lib/scenes/approved-shots";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) config({ path: ".env", quiet: true });
const suite = enabled ? describe.sequential : describe.skip;
const workspaceIds: string[] = [];
const userIds: string[] = [];

const SIZE = "1536x1024";

/**
 * Each Drizzle call here is one Neon HTTP round trip, and a test that approves
 * three images makes a dozen of them. The generous timeout is a network
 * budget, not a signal about correctness: these tests pass individually and
 * only exceed the default when run back to back.
 */
const ROUND_TRIP_BUDGET_MILLISECONDS = 180_000;

interface Fixture {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  userId: string;
}

/**
 * One succeeded, not-yet-approved image for a given shot of the scene.
 * `generationVersion` is unique per scene version by schema rule, so each call
 * takes its own.
 */
async function imageRow(
  fixture: Fixture,
  input: { shotIndex: number; generationVersion: number },
) {
  const id = randomUUID();
  await getDatabase()
    .insert(sceneImageGenerations)
    .values({
      id,
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      sceneId: fixture.sceneId,
      sceneVersionId: fixture.sceneVersionId,
      shotIndex: input.shotIndex,
      purpose: "scene",
      source: "user_uploaded",
      generationVersion: input.generationVersion,
      requestNonce: randomUUID(),
      status: "succeeded",
      reviewStatus: "pending",
      size: SIZE,
      outputFormat: "webp",
      estimatedCostCents: 0,
      actualCostCents: 0,
      progressPercent: 100,
      attemptCount: 0,
      assetObjectKey: `images/${id}.webp`,
      assetContentType: "image/webp",
      assetSizeBytes: 1024,
      assetWidth: 1536,
      assetHeight: 1024,
      assetEtag: id.replaceAll("-", ""),
      requestedByUserId: fixture.userId,
    });
  return id;
}

async function createFixture(): Promise<Fixture> {
  if (process.env.NODE_ENV === "production")
    throw new Error("Do not run fixtures in production.");
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const scriptVersionId = randomUUID();
  const analysisRunId = randomUUID();
  const sceneId = randomUUID();
  const sceneVersionId = randomUUID();
  const label = randomUUID();
  const now = new Date();
  userIds.push(userId);
  workspaceIds.push(workspaceId);

  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `shots-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Shot fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Shot workspace",
      slug: `shots-integration-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
    database.insert(projects).values({
      id: projectId,
      workspaceId,
      name: "Shot project",
      status: "planning",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: 1000,
      createdByUserId: userId,
    }),
    database.insert(projectScriptVersions).values({
      id: scriptVersionId,
      workspaceId,
      projectId,
      versionNumber: 1,
      content: "An isolated integration-test narration.",
      characterCount: 39,
      estimatedNarrationDurationSeconds: 5,
      createdByUserId: userId,
      status: "approved",
      approvedByUserId: userId,
      approvedAt: now,
    }),
    database.insert(sceneAnalysisRuns).values({
      id: analysisRunId,
      workspaceId,
      projectId,
      scriptVersionId,
      requestedByUserId: userId,
      idempotencyKey: `shots-analysis-${label}`,
      requestFingerprint: label.replaceAll("-", ""),
      model: "integration-test-model",
      promptVersion: "integration-v1",
      finalPrompt: "Integration fixture analysis prompt.",
      status: "completed",
      progressPercent: 100,
      estimatedCostCents: 1,
      actualCostCents: 1,
      attemptCount: 1,
      startedAt: now,
      completedAt: now,
    }),
    database.insert(scenes).values({
      id: sceneId,
      workspaceId,
      projectId,
      scriptVersionId,
      analysisRunId,
      sceneNumber: 1,
      status: "approved",
      currentVersion: 1,
    }),
    database.insert(sceneVersions).values({
      id: sceneVersionId,
      workspaceId,
      projectId,
      sceneId,
      versionNumber: 1,
      narrationText: "An isolated integration-test narration.",
      visualDescription: "A clean editorial illustration.",
      locationDescription: "A neutral studio.",
      actionDescription: "A presenter explains one concept.",
      cameraShot: "medium",
      cameraAngle: "eye-level",
      cameraMotion: "static",
      emotionalTone: "confident",
      characterNames: [],
      propNames: [],
      continuityNotes: "Maintain the same composition.",
      estimatedDurationMilliseconds: 6000,
      startTimeMilliseconds: 0,
      endTimeMilliseconds: 6000,
      createdByUserId: userId,
    }),
  ]);

  return { workspaceId, projectId, sceneId, sceneVersionId, userId };
}

suite("several images in one scene, against PostgreSQL", () => {
  afterAll(async () => {
    if (workspaceIds.length)
      await getDatabase()
        .delete(workspaces)
        .where(inArray(workspaces.id, workspaceIds));
    if (userIds.length)
      await getDatabase().delete(users).where(inArray(users.id, userIds));
  }, ROUND_TRIP_BUDGET_MILLISECONDS);

  it(
    "lets a scene hold two approved images at once",
    async () => {
      // This is the whole unlock. Before the index was keyed on the shot, the
      // database refused the second approval outright.
      const fixture = await createFixture();
      const first = await imageRow(fixture, {
        shotIndex: 0,
        generationVersion: 1,
      });
      const second = await imageRow(fixture, {
        shotIndex: 1,
        generationVersion: 2,
      });

      await approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: first,
        userId: fixture.userId,
      });
      await approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: second,
        userId: fixture.userId,
      });

      const approved = await listApprovedSceneImageAssets({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        sceneVersionIds: [fixture.sceneVersionId],
        size: SIZE,
      });
      expect(approved).toHaveLength(2);
    },
    ROUND_TRIP_BUDGET_MILLISECONDS,
  );

  it(
    "does not un-approve the first image when the second is approved",
    async () => {
      // The regression this slice had to fix: approval demoted every other
      // approved image for the scene, which would silently empty shot 0.
      const fixture = await createFixture();
      const first = await imageRow(fixture, {
        shotIndex: 0,
        generationVersion: 1,
      });
      const second = await imageRow(fixture, {
        shotIndex: 1,
        generationVersion: 2,
      });
      await approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: first,
        userId: fixture.userId,
      });
      await approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: second,
        userId: fixture.userId,
      });

      const shots = shotsBySceneVersion(
        await listApprovedSceneImageAssets({
          workspaceId: fixture.workspaceId,
          projectId: fixture.projectId,
          sceneVersionIds: [fixture.sceneVersionId],
          size: SIZE,
        }),
      ).get(fixture.sceneVersionId);
      expect(shots?.map((shot) => shot.generationId)).toEqual([first, second]);
      expect(shots?.map((shot) => shot.shotIndex)).toEqual([0, 1]);
    },
    ROUND_TRIP_BUDGET_MILLISECONDS,
  );

  it(
    "still refuses two rival images for the same shot",
    async () => {
      // Relaxing the index must not have removed the rule, only widened it: a
      // replacement for shot 0 demotes the previous shot 0, and never coexists.
      const fixture = await createFixture();
      const original = await imageRow(fixture, {
        shotIndex: 0,
        generationVersion: 1,
      });
      const replacement = await imageRow(fixture, {
        shotIndex: 0,
        generationVersion: 2,
      });
      const untouched = await imageRow(fixture, {
        shotIndex: 1,
        generationVersion: 3,
      });

      for (const generationId of [original, untouched, replacement])
        await approveSceneImageGeneration({
          workspaceId: fixture.workspaceId,
          projectId: fixture.projectId,
          generationId,
          userId: fixture.userId,
        });

      const approved = await listApprovedSceneImageAssets({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        sceneVersionIds: [fixture.sceneVersionId],
        size: SIZE,
      });
      const ids = approved.map((row) => row.generationId).sort();
      expect(ids).toEqual([replacement, untouched].sort());
      expect(ids).not.toContain(original);
    },
    ROUND_TRIP_BUDGET_MILLISECONDS,
  );

  it(
    "returns the shots in order whatever order they were approved in",
    async () => {
      // A render must reproduce, so the read cannot depend on approval order or
      // on whatever the planner happens to return first.
      const fixture = await createFixture();
      const zero = await imageRow(fixture, {
        shotIndex: 0,
        generationVersion: 1,
      });
      const one = await imageRow(fixture, {
        shotIndex: 1,
        generationVersion: 2,
      });
      const two = await imageRow(fixture, {
        shotIndex: 2,
        generationVersion: 3,
      });

      for (const generationId of [two, zero, one])
        await approveSceneImageGeneration({
          workspaceId: fixture.workspaceId,
          projectId: fixture.projectId,
          generationId,
          userId: fixture.userId,
        });

      const approved = await listApprovedSceneImageAssets({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        sceneVersionIds: [fixture.sceneVersionId],
        size: SIZE,
      });
      expect(approved.map((row) => row.generationId)).toEqual([zero, one, two]);
    },
    ROUND_TRIP_BUDGET_MILLISECONDS,
  );

  it(
    "keeps a scene with one image behaving exactly as before",
    async () => {
      const fixture = await createFixture();
      const only = await imageRow(fixture, {
        shotIndex: 0,
        generationVersion: 1,
      });
      await approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: only,
        userId: fixture.userId,
      });

      const approved = await listApprovedSceneImageAssets({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        sceneVersionIds: [fixture.sceneVersionId],
        size: SIZE,
      });
      expect(approved).toHaveLength(1);
      expect(approved[0]?.shotIndex).toBe(0);
    },
    ROUND_TRIP_BUDGET_MILLISECONDS,
  );

  it(
    "refuses a negative shot index at the database, not only in the form",
    async () => {
      const fixture = await createFixture();
      await expect(
        imageRow(fixture, { shotIndex: -1, generationVersion: 1 }),
      ).rejects.toThrow();
    },
    ROUND_TRIP_BUDGET_MILLISECONDS,
  );
});
