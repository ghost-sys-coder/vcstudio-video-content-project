import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import {
  createShortComposition,
  updateShortComposition,
} from "@/db/commands/short-commands";
import { getDatabase } from "@/db/drizzle";
import {
  projectOutputVariants,
  projects,
  projectScriptVersions,
  sceneAnalysisRuns,
  scenes,
  sceneVersions,
  shortClips,
  shortCompositions,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

type Fixture = {
  userId: string;
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
  sceneAId: string;
  sceneAVersionId: string;
  sceneBId: string;
  sceneBVersionId: string;
};

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

async function createFixture(): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const scriptVersionId = randomUUID();
  const analysisRunId = randomUUID();
  const sceneAId = randomUUID();
  const sceneAVersionId = randomUUID();
  const sceneBId = randomUUID();
  const sceneBVersionId = randomUUID();
  const outputVariantId = randomUUID();
  const label = randomUUID();
  const now = new Date();
  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);

  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `short-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Short Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Short Fixture Workspace",
      slug: `short-integration-${label}`,
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
      name: "Short Fixture Project",
      status: "readyToRender",
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: 1_000,
      createdByUserId: userId,
    }),
    database.insert(projectScriptVersions).values({
      id: scriptVersionId,
      workspaceId,
      projectId,
      versionNumber: 1,
      content: "An isolated integration-test narration.",
      characterCount: 39,
      estimatedNarrationDurationSeconds: 10,
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
      idempotencyKey: `short-analysis-${label}`,
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
    database.insert(scenes).values([
      {
        id: sceneAId,
        workspaceId,
        projectId,
        scriptVersionId,
        analysisRunId,
        sceneNumber: 1,
        status: "approved",
        currentVersion: 1,
      },
      {
        id: sceneBId,
        workspaceId,
        projectId,
        scriptVersionId,
        analysisRunId,
        sceneNumber: 2,
        status: "approved",
        currentVersion: 1,
      },
    ]),
    database.insert(sceneVersions).values([
      {
        id: sceneAVersionId,
        workspaceId,
        projectId,
        sceneId: sceneAId,
        versionNumber: 1,
        narrationText: "Scene A narration.",
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
        estimatedDurationMilliseconds: 5_000,
        startTimeMilliseconds: 0,
        endTimeMilliseconds: 5_000,
        createdByUserId: userId,
      },
      {
        id: sceneBVersionId,
        workspaceId,
        projectId,
        sceneId: sceneBId,
        versionNumber: 1,
        narrationText: "Scene B narration.",
        visualDescription: "A clean editorial illustration.",
        locationDescription: "A neutral studio.",
        actionDescription: "A presenter explains a second concept.",
        cameraShot: "medium",
        cameraAngle: "eye-level",
        cameraMotion: "static",
        emotionalTone: "confident",
        characterNames: [],
        propNames: [],
        continuityNotes: "Maintain the same composition.",
        estimatedDurationMilliseconds: 5_000,
        startTimeMilliseconds: 5_000,
        endTimeMilliseconds: 10_000,
        createdByUserId: userId,
      },
    ]),
    database.insert(projectOutputVariants).values({
      id: outputVariantId,
      workspaceId,
      projectId,
      name: "Vertical",
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
      status: "ready",
      createdByUserId: userId,
    }),
  ]);

  return {
    userId,
    workspaceId,
    projectId,
    outputVariantId,
    sceneAId,
    sceneAVersionId,
    sceneBId,
    sceneBVersionId,
  };
}

async function cleanup(): Promise<void> {
  const database = getDatabase();
  if (fixtureWorkspaceIds.size > 0)
    await database
      .delete(workspaces)
      .where(inArray(workspaces.id, [...fixtureWorkspaceIds]));
  if (fixtureUserIds.size > 0)
    await database.delete(users).where(inArray(users.id, [...fixtureUserIds]));
  fixtureWorkspaceIds.clear();
  fixtureUserIds.clear();
}

describeDatabase("updateShortComposition", () => {
  beforeAll(() => {
    if (process.env.NODE_ENV === "production")
      throw new Error("Integration tests must not run against production.");
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is required for integration tests.");
  });
  afterEach(cleanup);
  afterAll(cleanup);

  it("replaces a saved short's clips and preserves the composition id", async () => {
    const fixture = await createFixture();
    const created = await createShortComposition({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      outputVariantId: fixture.outputVariantId,
      name: "Original short",
      createdByUserId: fixture.userId,
      clips: [
        {
          id: randomUUID(),
          sourceSceneId: fixture.sceneAId,
          sourceSceneVersionId: fixture.sceneAVersionId,
          position: 1,
          sourceStartMilliseconds: 0,
          sourceEndMilliseconds: 5_000,
          transition: "cut",
        },
      ],
    });

    const updated = await updateShortComposition({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      shortCompositionId: created.id,
      name: "Renamed short",
      clips: [
        {
          id: randomUUID(),
          sourceSceneId: fixture.sceneBId,
          sourceSceneVersionId: fixture.sceneBVersionId,
          position: 1,
          sourceStartMilliseconds: 5_000,
          sourceEndMilliseconds: 9_000,
          transition: "fade",
        },
      ],
    });
    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Renamed short");

    const clips = await getDatabase()
      .select()
      .from(shortClips)
      .where(eq(shortClips.shortCompositionId, created.id));
    expect(clips).toHaveLength(1);
    expect(clips[0]?.sourceSceneId).toBe(fixture.sceneBId);
    expect(clips[0]?.transition).toBe("fade");

    const [composition] = await getDatabase()
      .select()
      .from(shortCompositions)
      .where(eq(shortCompositions.id, created.id));
    expect(composition?.name).toBe("Renamed short");
  }, 30_000);

  it("rejects updating a composition from another workspace without touching its clips", async () => {
    const owner = await createFixture();
    const other = await createFixture();
    const created = await createShortComposition({
      workspaceId: owner.workspaceId,
      projectId: owner.projectId,
      outputVariantId: owner.outputVariantId,
      name: "Owner short",
      createdByUserId: owner.userId,
      clips: [
        {
          id: randomUUID(),
          sourceSceneId: owner.sceneAId,
          sourceSceneVersionId: owner.sceneAVersionId,
          position: 1,
          sourceStartMilliseconds: 0,
          sourceEndMilliseconds: 5_000,
          transition: "cut",
        },
      ],
    });

    await expect(
      updateShortComposition({
        workspaceId: other.workspaceId,
        projectId: other.projectId,
        shortCompositionId: created.id,
        name: "Hijacked",
        clips: [
          {
            id: randomUUID(),
            sourceSceneId: other.sceneAId,
            sourceSceneVersionId: other.sceneAVersionId,
            position: 1,
            sourceStartMilliseconds: 0,
            sourceEndMilliseconds: 5_000,
            transition: "cut",
          },
        ],
      }),
    ).rejects.toThrow("SHORT_COMPOSITION_NOT_FOUND");

    const clips = await getDatabase()
      .select()
      .from(shortClips)
      .where(
        and(
          eq(shortClips.shortCompositionId, created.id),
          eq(shortClips.workspaceId, owner.workspaceId),
        ),
      );
    expect(clips).toHaveLength(1);
    expect(clips[0]?.sourceSceneId).toBe(owner.sceneAId);
  }, 30_000);
});
