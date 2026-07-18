import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
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
  cancelSceneAudioGeneration,
  claimSceneAudioRunning,
  completeSceneAudioGeneration,
  createSceneAudioGenerationReservation,
} from "@/db/commands/scene-audio-commands";
import {
  findSceneAudioGeneration,
  findSceneAudioReservation,
} from "@/db/repositories/scene-audio.repository";
import { getDatabase } from "@/db/drizzle";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  projects,
  projectScriptVersions,
  sceneAnalysisRuns,
  sceneAudioGenerations,
  scenes,
  sceneVersions,
  usageReservations,
  users,
  voicePresets,
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
  sceneId: string;
  sceneVersionId: string;
  voicePresetId: string;
};

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

async function createFixture(
  options: { maximumBudgetCents?: number } = {},
): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const scriptVersionId = randomUUID();
  const analysisRunId = randomUUID();
  const sceneId = randomUUID();
  const sceneVersionId = randomUUID();
  const voicePresetId = randomUUID();
  const label = randomUUID();
  const now = new Date();
  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);

  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `audio-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Phase 7 Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Phase 7 Workspace",
      slug: `audio-integration-${label}`,
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
      name: "Phase 7 Project",
      status: "planning",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: options.maximumBudgetCents ?? 1_000,
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
      idempotencyKey: `audio-analysis-${label}`,
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
      estimatedDurationMilliseconds: 5_000,
      startTimeMilliseconds: 0,
      endTimeMilliseconds: 5_000,
      createdByUserId: userId,
    }),
    database.insert(voicePresets).values({
      id: voicePresetId,
      workspaceId,
      name: "Integration Voice",
      slug: `integration-voice-${label}`,
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      isDefault: true,
      createdByUserId: userId,
    }),
  ]);

  return {
    userId,
    workspaceId,
    projectId,
    sceneId,
    sceneVersionId,
    voicePresetId,
  };
}

function reservationInput(
  fixture: Fixture,
  overrides: Partial<{
    generationVersion: number;
    requestNonce: string;
    idempotencyKey: string;
    estimatedCostCents: number;
  }> = {},
) {
  const now = new Date();
  return {
    generationId: randomUUID(),
    reservationId: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    sceneId: fixture.sceneId,
    sceneVersionId: fixture.sceneVersionId,
    voicePresetId: fixture.voicePresetId,
    generationVersion: overrides.generationVersion ?? 1,
    requestNonce: overrides.requestNonce ?? randomUUID(),
    idempotencyKey: overrides.idempotencyKey ?? `audio-idem-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    provider: "openai",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "mp3" as const,
    speedScaledPercent: 100,
    instructions: "",
    sampleRate: null,
    inputText: "An isolated integration-test narration.",
    inputCharacterCount: 39,
    estimatedCostCents: overrides.estimatedCostCents ?? 5,
    requestedByUserId: fixture.userId,
    expiresAt: new Date(now.getTime() + 60_000),
    budget: {
      workspaceDailyLimitCents: 500,
      workspaceMonthlyLimitCents: 5_000,
      dailyWindowStart: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      ),
      monthlyWindowStart: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      ),
    },
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

describeDatabase("Phase 7 scene audio invariants", () => {
  beforeAll(() => {
    if (process.env.NODE_ENV === "production")
      throw new Error("Integration tests must not run against production.");
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is required for integration tests.");
  });
  afterEach(cleanup);
  afterAll(cleanup);

  it("reserves once and treats the same request nonce as idempotent", async () => {
    const fixture = await createFixture();
    const input = reservationInput(fixture);
    const first = await createSceneAudioGenerationReservation(input);
    const second = await createSceneAudioGenerationReservation(input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.generation.id).toBe(first.generation.id);

    const reservations = await getDatabase()
      .select({ id: usageReservations.id })
      .from(usageReservations)
      .where(eq(usageReservations.audioGenerationId, first.generation.id));
    expect(reservations).toHaveLength(1);
  }, 30_000);

  it("rejects a reservation that exceeds the project budget", async () => {
    const fixture = await createFixture({ maximumBudgetCents: 3 });
    await expect(
      createSceneAudioGenerationReservation(
        reservationInput(fixture, { estimatedCostCents: 10 }),
      ),
    ).rejects.toBeInstanceOf(BudgetExceededError);

    const generations = await getDatabase()
      .select({ id: sceneAudioGenerations.id })
      .from(sceneAudioGenerations)
      .where(eq(sceneAudioGenerations.projectId, fixture.projectId));
    expect(generations).toHaveLength(0);
  }, 30_000);

  it("cancels a queued reservation and releases its budget", async () => {
    const fixture = await createFixture();
    const reservation = await createSceneAudioGenerationReservation(
      reservationInput(fixture),
    );
    const result = await cancelSceneAudioGeneration({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId: reservation.generation.id,
    });
    expect(result.cancelled).toBe(true);

    const generation = await findSceneAudioGeneration({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId: reservation.generation.id,
    });
    expect(generation?.status).toBe("cancelled");
    const released = await findSceneAudioReservation({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId: reservation.generation.id,
    });
    expect(released?.status).toBe("released");
  }, 30_000);

  it("completes a claimed generation and reconciles its reservation with duration", async () => {
    const fixture = await createFixture();
    const reservation = await createSceneAudioGenerationReservation(
      reservationInput(fixture),
    );
    await claimSceneAudioRunning({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId: reservation.generation.id,
      attemptNumber: 1,
      providerRequestId: randomUUID(),
    });
    const completion = await completeSceneAudioGeneration({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId: reservation.generation.id,
      providerRequestId: "req_integration",
      actualCostCents: 5,
      durationMilliseconds: 4200,
      asset: {
        objectKey: `integration/${reservation.generation.id}.mp3`,
        contentType: "audio/mpeg",
        sizeBytes: 2048,
        etag: "etag-integration",
      },
    });
    expect(completion.completed).toBe(true);
    expect(completion.generation.status).toBe("succeeded");
    expect(completion.generation.durationMilliseconds).toBe(4200);

    const reconciled = await findSceneAudioReservation({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId: reservation.generation.id,
    });
    expect(reconciled).toMatchObject({
      status: "reconciled",
      actualCostCents: 5,
    });
  }, 30_000);

  it("rejects a cross-workspace voice preset relationship", async () => {
    const first = await createFixture();
    const second = await createFixture();
    await expect(
      getDatabase()
        .insert(sceneAudioGenerations)
        .values({
          ...reservationInputRow(second),
          voicePresetId: first.voicePresetId,
        }),
    ).rejects.toMatchObject({});
  }, 30_000);
});

function reservationInputRow(fixture: Fixture) {
  return {
    id: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    sceneId: fixture.sceneId,
    sceneVersionId: fixture.sceneVersionId,
    voicePresetId: fixture.voicePresetId,
    generationVersion: 1,
    requestNonce: randomUUID(),
    idempotencyKey: `audio-idem-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    provider: "openai",
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    format: "mp3" as const,
    speedScaledPercent: 100,
    inputText: "Cross-workspace attempt.",
    inputCharacterCount: 24,
    estimatedCostCents: 5,
    requestedByUserId: fixture.userId,
  };
}
