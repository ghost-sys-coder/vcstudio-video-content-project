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
  approveSceneImageGeneration,
  completeSceneImageGeneration,
  failSceneImageGeneration,
} from "@/db/commands/scene-image-commands";
import { getDatabase } from "@/db/drizzle";
import {
  projects,
  projectScriptVersions,
  promptTemplateVersions,
  providerRequests,
  sceneAnalysisRuns,
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
  stylePresetId: string;
  stylePresetVersionId: string;
};

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();
let promptTemplateVersionId = "";

function fixtureGenerationValues(input: {
  fixture: Fixture;
  generationId: string;
  generationVersion: number;
  status: "running" | "succeeded";
  size?: "1536x1024" | "1024x1536" | "1024x1024";
}): typeof sceneImageGenerations.$inferInsert {
  const succeeded = input.status === "succeeded";
  const now = new Date();

  return {
    id: input.generationId,
    workspaceId: input.fixture.workspaceId,
    projectId: input.fixture.projectId,
    sceneId: input.fixture.sceneId,
    sceneVersionId: input.fixture.sceneVersionId,
    stylePresetVersionId: input.fixture.stylePresetVersionId,
    promptTemplateVersionId,
    generationVersion: input.generationVersion,
    requestNonce: randomUUID(),
    status: input.status,
    reviewStatus: "pending",
    idempotencyKey: `integration-generation-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    model: "integration-test-model",
    quality: "medium",
    size: input.size ?? "1536x1024",
    outputFormat: "webp",
    outputCompression: 90,
    promptTemplateVersion: "scene-image-v1",
    stylePresetVersion: 1,
    finalPrompt: "Isolated database integration fixture prompt.",
    estimatedCostCents: 10,
    actualCostCents: succeeded ? 7 : null,
    progressPercent: succeeded ? 100 : 25,
    attemptCount: 1,
    assetObjectKey: succeeded ? `integration/${input.generationId}.webp` : null,
    assetContentType: succeeded ? "image/webp" : null,
    assetSizeBytes: succeeded ? 1024 : null,
    assetWidth: succeeded ? 1536 : null,
    assetHeight: succeeded ? 1024 : null,
    assetEtag: succeeded ? `etag-${input.generationId}` : null,
    requestedByUserId: input.fixture.userId,
    startedAt: now,
    completedAt: succeeded ? now : null,
  };
}

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
      clerkUserId: `integration-${uniqueLabel}`,
      email: `${uniqueLabel}@integration.invalid`,
      displayName: "Phase 5 Integration Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Phase 5 Integration Workspace",
      slug: `integration-${uniqueLabel}`,
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
      name: "Phase 5 Integration Project",
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
      idempotencyKey: `integration-analysis-${uniqueLabel}`,
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
      slug: `integration-style-${uniqueLabel}`,
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
    stylePresetId,
    stylePresetVersionId,
  };
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

function databaseErrorField(error: unknown, field: string): string | null {
  const pending: unknown[] = [error];
  const visited = new Set<object>();

  while (pending.length > 0) {
    const candidate = pending.shift();
    if (typeof candidate !== "object" || candidate === null) continue;
    if (visited.has(candidate)) continue;
    visited.add(candidate);

    const value = Reflect.get(candidate, field);
    if (typeof value === "string") return value;

    pending.push(
      Reflect.get(candidate, "cause"),
      Reflect.get(candidate, "sourceError"),
    );
  }

  return null;
}

async function expectForeignKeyViolation(
  operation: () => Promise<unknown>,
  constraint: string,
): Promise<void> {
  try {
    await operation();
  } catch (error) {
    expect(databaseErrorField(error, "code")).toBe("23503");
    expect(databaseErrorField(error, "constraint")).toBe(constraint);
    return;
  }

  throw new Error(`Expected foreign-key violation for ${constraint}.`);
}

describeDatabase("Phase 5 PostgreSQL invariants", () => {
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
        "Apply the Phase 5 migration before running database integration tests.",
      );
    promptTemplateVersionId = promptTemplate.id;
  });

  afterEach(cleanupFixtures);
  afterAll(cleanupFixtures);

  it("commits exactly one terminal generation and ledger event during a completion/failure race", async () => {
    const database = getDatabase();
    const fixture = await createFixture();
    const generationId = randomUUID();
    const providerRequestId = randomUUID();
    const providerRequestIdentifier = `integration-${randomUUID()}`;
    const reservationId = randomUUID();
    const usage = {
      textInputUnits: 10,
      imageInputUnits: 20,
      outputUnits: 30,
    };
    const now = new Date();

    await database.batch([
      database.insert(sceneImageGenerations).values(
        fixtureGenerationValues({
          fixture,
          generationId,
          generationVersion: 1,
          status: "running",
        }),
      ),
      database.insert(providerRequests).values({
        id: providerRequestId,
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId,
        provider: "integration",
        model: "integration-test-model",
        status: "succeeded",
        providerRequestId: providerRequestIdentifier,
        idempotencyKey: `integration-provider-${randomUUID()}`,
        attemptNumber: 1,
        ...usage,
        estimatedCostCents: 10,
        actualCostCents: 7,
        startedAt: now,
        completedAt: now,
      }),
      database.insert(usageReservations).values({
        id: reservationId,
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        operationType: "scene_image_generation",
        imageGenerationId: generationId,
        status: "pending",
        reservedCostCents: 10,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      database.insert(usageEvents).values({
        id: randomUUID(),
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        reservationId,
        operationType: "scene_image_generation",
        eventType: "reserved",
        estimatedCostCents: 10,
      }),
    ]);

    const results = await Promise.allSettled([
      completeSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId,
        attemptNumber: 1,
        providerRequestIdentifier,
        usage,
        actualCostCents: 7,
        asset: {
          objectKey: `integration/${generationId}.webp`,
          contentType: "image/webp",
          sizeBytes: 1024,
          width: 1536,
          height: 1024,
          etag: `etag-${generationId}`,
        },
      }),
      failSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId,
        attemptNumber: 1,
        category: "integration_race",
        safeErrorMessage: "Synthetic concurrent failure.",
        providerRequestStatus: "succeeded",
        providerRequestIdentifier,
        usage,
        actualCostCents: 7,
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );

    const terminalGenerations = await database
      .select({
        id: sceneImageGenerations.id,
        status: sceneImageGenerations.status,
      })
      .from(sceneImageGenerations)
      .where(
        and(
          eq(sceneImageGenerations.id, generationId),
          inArray(sceneImageGenerations.status, ["succeeded", "failed"]),
        ),
      );
    const [reservation] = await database
      .select({
        status: usageReservations.status,
        actualCostCents: usageReservations.actualCostCents,
      })
      .from(usageReservations)
      .where(eq(usageReservations.id, reservationId))
      .limit(1);
    const terminalEvents = await database
      .select({
        eventType: usageEvents.eventType,
        actualCostCents: usageEvents.actualCostCents,
      })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.reservationId, reservationId),
          inArray(usageEvents.eventType, ["reconciled", "released"]),
        ),
      );

    expect(terminalGenerations).toHaveLength(1);
    expect(reservation).toEqual({ status: "reconciled", actualCostCents: 7 });
    expect(terminalEvents).toEqual([
      { eventType: "reconciled", actualCostCents: 7 },
    ]);
  }, 30_000);

  it("leaves exactly one approved successful generation after concurrent approvals", async () => {
    const database = getDatabase();
    const fixture = await createFixture();
    const firstGenerationId = randomUUID();
    const secondGenerationId = randomUUID();

    await database.batch([
      database.insert(sceneImageGenerations).values(
        fixtureGenerationValues({
          fixture,
          generationId: firstGenerationId,
          generationVersion: 1,
          status: "succeeded",
        }),
      ),
      database.insert(sceneImageGenerations).values(
        fixtureGenerationValues({
          fixture,
          generationId: secondGenerationId,
          generationVersion: 2,
          status: "succeeded",
        }),
      ),
    ]);

    const results = await Promise.allSettled([
      approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: firstGenerationId,
        userId: fixture.userId,
      }),
      approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: secondGenerationId,
        userId: fixture.userId,
      }),
    ]);
    const approved = await database
      .select({ id: sceneImageGenerations.id })
      .from(sceneImageGenerations)
      .where(
        and(
          eq(sceneImageGenerations.sceneVersionId, fixture.sceneVersionId),
          eq(sceneImageGenerations.status, "succeeded"),
          eq(sceneImageGenerations.reviewStatus, "approved"),
        ),
      );

    expect(results.some(({ status }) => status === "fulfilled")).toBe(true);
    expect(approved).toHaveLength(1);
    expect([firstGenerationId, secondGenerationId]).toContain(approved[0]?.id);
  }, 30_000);

  it("approving one size does not demote an already-approved different size", async () => {
    const database = getDatabase();
    const fixture = await createFixture();
    const landscapeId = randomUUID();
    const portraitId = randomUUID();

    await database.batch([
      database.insert(sceneImageGenerations).values(
        fixtureGenerationValues({
          fixture,
          generationId: landscapeId,
          generationVersion: 1,
          status: "succeeded",
          size: "1536x1024",
        }),
      ),
      database.insert(sceneImageGenerations).values(
        fixtureGenerationValues({
          fixture,
          generationId: portraitId,
          generationVersion: 2,
          status: "succeeded",
          size: "1024x1536",
        }),
      ),
    ]);

    await approveSceneImageGeneration({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId: landscapeId,
      userId: fixture.userId,
    });
    await approveSceneImageGeneration({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId: portraitId,
      userId: fixture.userId,
    });

    const approved = await database
      .select({
        id: sceneImageGenerations.id,
        size: sceneImageGenerations.size,
      })
      .from(sceneImageGenerations)
      .where(
        and(
          eq(sceneImageGenerations.sceneVersionId, fixture.sceneVersionId),
          eq(sceneImageGenerations.reviewStatus, "approved"),
        ),
      );

    expect(approved).toHaveLength(2);
    expect(approved.map((row) => row.id).sort()).toEqual(
      [landscapeId, portraitId].sort(),
    );
  }, 30_000);

  it("concurrent approvals of two different sizes both succeed independently", async () => {
    const database = getDatabase();
    const fixture = await createFixture();
    const landscapeId = randomUUID();
    const portraitId = randomUUID();

    await database.batch([
      database.insert(sceneImageGenerations).values(
        fixtureGenerationValues({
          fixture,
          generationId: landscapeId,
          generationVersion: 1,
          status: "succeeded",
          size: "1536x1024",
        }),
      ),
      database.insert(sceneImageGenerations).values(
        fixtureGenerationValues({
          fixture,
          generationId: portraitId,
          generationVersion: 2,
          status: "succeeded",
          size: "1024x1536",
        }),
      ),
    ]);

    const results = await Promise.allSettled([
      approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: landscapeId,
        userId: fixture.userId,
      }),
      approveSceneImageGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generationId: portraitId,
        userId: fixture.userId,
      }),
    ]);
    const approved = await database
      .select({ id: sceneImageGenerations.id })
      .from(sceneImageGenerations)
      .where(
        and(
          eq(sceneImageGenerations.sceneVersionId, fixture.sceneVersionId),
          eq(sceneImageGenerations.reviewStatus, "approved"),
        ),
      );

    expect(results.every(({ status }) => status === "fulfilled")).toBe(true);
    expect(approved).toHaveLength(2);
  }, 30_000);

  it("rejects cross-workspace Phase 5 relationships", async () => {
    const database = getDatabase();
    const first = await createFixture();
    const second = await createFixture();

    await expectForeignKeyViolation(async () => {
      await database.insert(stylePresetVersions).values({
        id: randomUUID(),
        workspaceId: second.workspaceId,
        stylePresetId: first.stylePresetId,
        version: 2,
        name: "Cross-workspace style",
        description: "Must be rejected.",
        positivePrompt: "Must be rejected.",
        negativePrompt: "Must be rejected.",
        defaultAspectRatio: "16:9",
        createdByUserId: second.userId,
      });
    }, "style_preset_versions_tenant_preset_fkey");

    await expectForeignKeyViolation(async () => {
      await database.insert(sceneImageGenerations).values(
        fixtureGenerationValues({
          fixture: {
            ...second,
            stylePresetVersionId: first.stylePresetVersionId,
          },
          generationId: randomUUID(),
          generationVersion: 1,
          status: "running",
        }),
      );
    }, "scene_image_generations_tenant_style_fkey");
  }, 30_000);
});
