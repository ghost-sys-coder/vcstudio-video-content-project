import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
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

import { saveSceneVariantFramingBulk } from "@/db/commands/output-variant-commands";
import { getDatabase } from "@/db/drizzle";
import {
  projectOutputVariants,
  projects,
  projectScriptVersions,
  sceneAnalysisRuns,
  sceneVariantFramings,
  scenes,
  sceneVersions,
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
      clerkUserId: `framing-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Framing Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Framing Fixture Workspace",
      slug: `framing-integration-${label}`,
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
      name: "Framing Fixture Project",
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
      idempotencyKey: `framing-analysis-${label}`,
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

describeDatabase("saveSceneVariantFramingBulk", () => {
  beforeAll(() => {
    if (process.env.NODE_ENV === "production")
      throw new Error("Integration tests must not run against production.");
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is required for integration tests.");
  });
  afterEach(cleanup);
  afterAll(cleanup);

  it("applies one shared framing to multiple scenes in a single call", async () => {
    const fixture = await createFixture();
    const imageId = randomUUID();

    await saveSceneVariantFramingBulk({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      outputVariantId: fixture.outputVariantId,
      mode: "cover",
      focalPointXBps: 2500,
      focalPointYBps: 7500,
      scaleBps: 12000,
      backgroundColor: "#112233",
      updatedByUserId: fixture.userId,
      targets: [
        {
          sceneId: fixture.sceneAId,
          sceneVersionId: fixture.sceneAVersionId,
          sourceImageGenerationId: imageId,
        },
        {
          sceneId: fixture.sceneBId,
          sceneVersionId: fixture.sceneBVersionId,
          sourceImageGenerationId: imageId,
        },
      ],
    });

    const rows = await getDatabase()
      .select()
      .from(sceneVariantFramings)
      .where(eq(sceneVariantFramings.outputVariantId, fixture.outputVariantId))
      .orderBy(asc(sceneVariantFramings.sceneVersionId));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.focalPointXBps).toBe(2500);
      expect(row.focalPointYBps).toBe(7500);
      expect(row.scaleBps).toBe(12000);
      expect(row.backgroundColor).toBe("#112233");
    }
  }, 30_000);

  it("updates an existing row on conflict instead of duplicating it", async () => {
    const fixture = await createFixture();
    const imageId = randomUUID();
    const target = {
      sceneId: fixture.sceneAId,
      sceneVersionId: fixture.sceneAVersionId,
      sourceImageGenerationId: imageId,
    };

    await saveSceneVariantFramingBulk({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      outputVariantId: fixture.outputVariantId,
      mode: "cover",
      focalPointXBps: 1000,
      focalPointYBps: 1000,
      scaleBps: 10000,
      backgroundColor: "#000000",
      updatedByUserId: fixture.userId,
      targets: [target],
    });
    await saveSceneVariantFramingBulk({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      outputVariantId: fixture.outputVariantId,
      mode: "contain",
      focalPointXBps: 9000,
      focalPointYBps: 9000,
      scaleBps: 15000,
      backgroundColor: "#ffffff",
      updatedByUserId: fixture.userId,
      targets: [target],
    });

    const rows = await getDatabase()
      .select()
      .from(sceneVariantFramings)
      .where(eq(sceneVariantFramings.sceneVersionId, fixture.sceneAVersionId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.mode).toBe("contain");
    expect(rows[0]?.focalPointXBps).toBe(9000);
    expect(rows[0]?.backgroundColor).toBe("#ffffff");
  }, 30_000);
});
