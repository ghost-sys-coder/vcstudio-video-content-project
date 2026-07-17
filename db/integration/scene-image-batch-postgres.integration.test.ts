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
  cancelSceneImageBatch,
  createSceneImageBatch,
} from "@/db/commands/scene-image-batch-commands";
import {
  getSceneImageBatchAggregate,
  listSceneImageGenerationsByBatch,
} from "@/db/repositories/scene-image-batches.repository";
import { getDatabase } from "@/db/drizzle";
import {
  projects,
  projectScriptVersions,
  promptTemplateVersions,
  sceneAnalysisRuns,
  sceneImageBatches,
  sceneImageGenerations,
  scenes,
  sceneVersions,
  stylePresets,
  stylePresetVersions,
  usageEvents,
  usageReservations,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

const databaseIntegrationEnabled =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";

if (databaseIntegrationEnabled) loadEnvironment({ path: ".env", quiet: true });

const describeDatabase = databaseIntegrationEnabled
  ? describe.sequential
  : describe.skip;

type Fixture = {
  userId: string;
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  stylePresetVersionId: string;
};

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();
let promptTemplateVersionId = "";

async function createFixture(): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const scriptVersionId = randomUUID();
  const analysisRunId = randomUUID();
  const sceneId = randomUUID();
  const sceneVersionId = randomUUID();
  const stylePresetId = randomUUID();
  const stylePresetVersionId = randomUUID();
  const uniqueLabel = randomUUID();
  const now = new Date();

  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);

  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `batch-integration-${uniqueLabel}`,
      email: `${uniqueLabel}@integration.invalid`,
      displayName: "Phase 6 Integration Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Phase 6 Integration Workspace",
      slug: `batch-integration-${uniqueLabel}`,
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
      name: "Phase 6 Integration Project",
      status: "planning",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
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
      idempotencyKey: `batch-integration-analysis-${uniqueLabel}`,
      requestFingerprint: uniqueLabel.replaceAll("-", ""),
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
      estimatedDurationMilliseconds: 5_000,
      startTimeMilliseconds: 0,
      endTimeMilliseconds: 5_000,
      createdByUserId: userId,
    }),
    database.insert(stylePresets).values({
      id: stylePresetId,
      workspaceId,
      slug: `batch-integration-style-${uniqueLabel}`,
      createdByUserId: userId,
    }),
    database.insert(stylePresetVersions).values({
      id: stylePresetVersionId,
      workspaceId,
      stylePresetId,
      version: 1,
      name: "Integration Style",
      description: "Isolated database integration fixture.",
      positivePrompt: "Clean editorial illustration.",
      negativePrompt: "No watermark.",
      defaultAspectRatio: "16:9",
      createdByUserId: userId,
    }),
  ]);

  return {
    userId,
    workspaceId,
    projectId,
    sceneId,
    sceneVersionId,
    stylePresetVersionId,
  };
}

function generationValues(input: {
  fixture: Fixture;
  batchId: string;
  generationId: string;
  generationVersion: number;
  status: "pending" | "running" | "succeeded";
}): typeof sceneImageGenerations.$inferInsert {
  const succeeded = input.status === "succeeded";
  return {
    id: input.generationId,
    workspaceId: input.fixture.workspaceId,
    projectId: input.fixture.projectId,
    sceneId: input.fixture.sceneId,
    sceneVersionId: input.fixture.sceneVersionId,
    stylePresetVersionId: input.fixture.stylePresetVersionId,
    promptTemplateVersionId,
    batchId: input.batchId,
    generationVersion: input.generationVersion,
    requestNonce: randomUUID(),
    status: input.status,
    reviewStatus: "pending",
    idempotencyKey: `batch-integration-generation-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    model: "integration-test-model",
    quality: "low",
    size: "1536x1024",
    outputFormat: "webp",
    outputCompression: 80,
    promptTemplateVersion: "scene-image-v1",
    stylePresetVersion: 1,
    finalPrompt: "Isolated database integration fixture prompt.",
    estimatedCostCents: 10,
    actualCostCents: succeeded ? 7 : null,
    progressPercent: succeeded ? 100 : input.status === "running" ? 25 : 0,
    attemptCount: input.status === "pending" ? 0 : 1,
    requestedByUserId: input.fixture.userId,
  };
}

async function seedBatchWithReservation(input: {
  fixture: Fixture;
  batchId: string;
  generationId: string;
  generationVersion: number;
  status: "pending" | "running";
}): Promise<void> {
  const database = getDatabase();
  const reservationId = randomUUID();
  await database.batch([
    database
      .insert(sceneImageGenerations)
      .values(generationValues({ ...input, status: input.status })),
    database.insert(usageReservations).values({
      id: reservationId,
      workspaceId: input.fixture.workspaceId,
      projectId: input.fixture.projectId,
      operationType: "scene_image_generation",
      imageGenerationId: input.generationId,
      status: "pending",
      reservedCostCents: 10,
      expiresAt: new Date(Date.now() + 60_000),
    }),
    database.insert(usageEvents).values({
      id: randomUUID(),
      workspaceId: input.fixture.workspaceId,
      projectId: input.fixture.projectId,
      reservationId,
      operationType: "scene_image_generation",
      eventType: "reserved",
      estimatedCostCents: 10,
    }),
  ]);
}

async function insertBatch(input: {
  fixture: Fixture;
  batchId: string;
  requestNonce: string;
  status?: "pending" | "processing";
}): Promise<void> {
  await getDatabase()
    .insert(sceneImageBatches)
    .values({
      id: input.batchId,
      workspaceId: input.fixture.workspaceId,
      projectId: input.fixture.projectId,
      status: input.status ?? "processing",
      requestNonce: input.requestNonce,
      stylePresetVersionId: input.fixture.stylePresetVersionId,
      quality: "low",
      size: "1536x1024",
      requestedSceneCount: 2,
      reservedSceneCount: 2,
      estimatedCostCents: 20,
      requestedByUserId: input.fixture.userId,
    });
}

async function cleanupFixtures(): Promise<void> {
  const database = getDatabase();
  const workspaceIds = [...fixtureWorkspaceIds];
  const userIds = [...fixtureUserIds];
  if (workspaceIds.length > 0)
    await database
      .delete(workspaces)
      .where(inArray(workspaces.id, workspaceIds));
  if (userIds.length > 0)
    await database.delete(users).where(inArray(users.id, userIds));
  fixtureWorkspaceIds.clear();
  fixtureUserIds.clear();
}

describeDatabase("Phase 6 scene image batch invariants", () => {
  beforeAll(async () => {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "Database integration tests must not run against production.",
      );
    if (!process.env.DATABASE_URL)
      throw new Error(
        "DATABASE_URL is required when RUN_DATABASE_INTEGRATION_TESTS=true.",
      );
    const [promptTemplate] = await getDatabase()
      .select({ id: promptTemplateVersions.id })
      .from(promptTemplateVersions)
      .where(
        and(
          eq(promptTemplateVersions.templateKey, "scene-image"),
          eq(promptTemplateVersions.version, "scene-image-v1"),
        ),
      )
      .limit(1);
    if (!promptTemplate)
      throw new Error(
        "Apply the scene-image migration before running batch integration tests.",
      );
    promptTemplateVersionId = promptTemplate.id;
  });

  afterEach(cleanupFixtures);
  afterAll(cleanupFixtures);

  it("aggregates child generation statuses and costs for a batch", async () => {
    const database = getDatabase();
    const fixture = await createFixture();
    const batchId = randomUUID();
    await insertBatch({ fixture, batchId, requestNonce: randomUUID() });
    await database.batch([
      database.insert(sceneImageGenerations).values(
        generationValues({
          fixture,
          batchId,
          generationId: randomUUID(),
          generationVersion: 1,
          status: "succeeded",
        }),
      ),
      database.insert(sceneImageGenerations).values(
        generationValues({
          fixture,
          batchId,
          generationId: randomUUID(),
          generationVersion: 2,
          status: "running",
        }),
      ),
    ]);

    const aggregate = await getSceneImageBatchAggregate({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      batchId,
    });

    expect(aggregate.counts).toMatchObject({
      total: 2,
      succeeded: 1,
      running: 1,
    });
    expect(aggregate.estimatedCostCents).toBe(20);
    expect(aggregate.actualCostCents).toBe(7);
  }, 30_000);

  it("cancels queued generations and releases their reservations without touching running work", async () => {
    const database = getDatabase();
    const fixture = await createFixture();
    const batchId = randomUUID();
    const pendingId = randomUUID();
    const runningId = randomUUID();
    await insertBatch({ fixture, batchId, requestNonce: randomUUID() });
    await seedBatchWithReservation({
      fixture,
      batchId,
      generationId: pendingId,
      generationVersion: 1,
      status: "pending",
    });
    await seedBatchWithReservation({
      fixture,
      batchId,
      generationId: runningId,
      generationVersion: 2,
      status: "running",
    });

    const result = await cancelSceneImageBatch({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      batchId,
    });
    expect(result.cancelledGenerationCount).toBe(1);

    const rows = await listSceneImageGenerationsByBatch({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      batchId,
    });
    const byId = new Map(rows.map((row) => [row.id, row.status]));
    expect(byId.get(pendingId)).toBe("cancelled");
    expect(byId.get(runningId)).toBe("running");

    const [releasedReservation] = await database
      .select({ status: usageReservations.status })
      .from(usageReservations)
      .where(eq(usageReservations.imageGenerationId, pendingId))
      .limit(1);
    expect(releasedReservation?.status).toBe("released");

    const [batch] = await database
      .select({ status: sceneImageBatches.status })
      .from(sceneImageBatches)
      .where(eq(sceneImageBatches.id, batchId))
      .limit(1);
    expect(batch?.status).toBe("cancelled");
  }, 30_000);

  it("treats a duplicate batch request nonce as the same batch", async () => {
    const fixture = await createFixture();
    const requestNonce = randomUUID();
    const first = await createSceneImageBatch({
      batchId: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      requestNonce,
      stylePresetVersionId: fixture.stylePresetVersionId,
      quality: "low",
      size: "1536x1024",
      requestedSceneCount: 2,
      estimatedCostCents: 20,
      requestedByUserId: fixture.userId,
    });
    const second = await createSceneImageBatch({
      batchId: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      requestNonce,
      stylePresetVersionId: fixture.stylePresetVersionId,
      quality: "low",
      size: "1536x1024",
      requestedSceneCount: 2,
      estimatedCostCents: 20,
      requestedByUserId: fixture.userId,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.batch.id).toBe(first.batch.id);
  }, 30_000);
});
