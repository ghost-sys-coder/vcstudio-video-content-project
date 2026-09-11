import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDatabase } from "@/db/drizzle";
import {
  projects,
  projectScriptVersions,
  sceneAnalysisRuns,
  sceneAudioGenerations,
  sceneCaptionCues,
  scenes,
  sceneVersions,
  users,
  voicePresets,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import {
  clearSceneCaptionCues,
  saveSceneCaptionCues,
  CaptionCueConflictError,
} from "@/db/commands/scene-caption-cue-commands";
import {
  findSceneCaptionCues,
  listSceneCaptionCues,
} from "@/db/repositories/scene-caption-cues.repository";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) config({ path: ".env", quiet: true });
const suite = enabled ? describe.sequential : describe.skip;
const workspaceIds: string[] = [];
const userIds: string[] = [];

interface Fixture {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  audioGenerationId: string;
  userId: string;
}

async function audioRow(fixture: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  voicePresetId: string;
  userId: string;
  // A replacement take is a new generation version; the schema enforces one
  // row per (scene version, generation version).
  generationVersion?: number;
}) {
  const id = randomUUID();
  await getDatabase()
    .insert(sceneAudioGenerations)
    .values({
      id,
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      sceneId: fixture.sceneId,
      sceneVersionId: fixture.sceneVersionId,
      voicePresetId: fixture.voicePresetId,
      generationVersion: fixture.generationVersion ?? 1,
      requestNonce: randomUUID(),
      format: "mp3",
      inputText: "An isolated integration-test narration.",
      inputCharacterCount: 39,
      estimatedCostCents: 5,
      durationMilliseconds: 6000,
      status: "succeeded",
      reviewStatus: "approved",
      assetObjectKey: `audio/${id}.mp3`,
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
  const voicePresetId = randomUUID();
  const label = randomUUID();
  const now = new Date();
  userIds.push(userId);
  workspaceIds.push(workspaceId);

  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `cues-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Cue fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Cue workspace",
      slug: `cues-integration-${label}`,
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
      name: "Cue project",
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
      idempotencyKey: `cues-analysis-${label}`,
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
    database.insert(voicePresets).values({
      id: voicePresetId,
      workspaceId,
      name: "Integration voice",
      slug: `integration-voice-${label}`,
      model: "gpt-4o-mini-tts",
      voice: "alloy",
      isDefault: true,
      createdByUserId: userId,
    }),
  ]);

  const audioGenerationId = await audioRow({
    workspaceId,
    projectId,
    sceneId,
    sceneVersionId,
    voicePresetId,
    userId,
  });
  return {
    workspaceId,
    projectId,
    sceneId,
    sceneVersionId,
    audioGenerationId,
    userId,
  };
}

const CUES = [
  { text: "First half", startMilliseconds: 0, endMilliseconds: 3000 },
  { text: "Second half", startMilliseconds: 3000, endMilliseconds: 6000 },
];

suite("hand-set caption times against PostgreSQL", () => {
  afterAll(async () => {
    if (workspaceIds.length)
      await getDatabase()
        .delete(workspaces)
        .where(inArray(workspaces.id, workspaceIds));
    if (userIds.length)
      await getDatabase().delete(users).where(inArray(users.id, userIds));
  }, 30_000);

  it("saves a correction and reads it back for that exact narration", async () => {
    const fixture = await createFixture();
    const saved = await saveSceneCaptionCues({
      ...fixture,
      cues: CUES,
      expectedRevision: null,
    });
    expect(saved.revision).toBe(1);
    const found = await findSceneCaptionCues({
      workspaceId: fixture.workspaceId,
      sceneVersionId: fixture.sceneVersionId,
      audioGenerationId: fixture.audioGenerationId,
    });
    expect(found?.cues).toEqual(CUES);
  }, 30_000);

  it("stops applying when the narration is replaced, without deleting anything", async () => {
    // The acceptance criterion in one test: replacing the audio invalidates
    // that scene's corrections by construction, because they are keyed on the
    // recording they describe. The old row survives, so re-approving the
    // earlier take brings its corrections back.
    const fixture = await createFixture();
    await saveSceneCaptionCues({
      ...fixture,
      cues: CUES,
      expectedRevision: null,
    });
    // A new take is approved only after the previous one stops being: the
    // schema allows one approved narration per scene version, which is the
    // real replacement flow this test has to follow.
    await getDatabase()
      .update(sceneAudioGenerations)
      .set({ reviewStatus: "rejected" })
      .where(eq(sceneAudioGenerations.id, fixture.audioGenerationId));
    const replacement = await audioRow({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      sceneId: fixture.sceneId,
      sceneVersionId: fixture.sceneVersionId,
      voicePresetId: (
        await getDatabase()
          .select({ id: voicePresets.id })
          .from(voicePresets)
          .where(eq(voicePresets.workspaceId, fixture.workspaceId))
          .limit(1)
      )[0]!.id,
      userId: fixture.userId,
      generationVersion: 2,
    });

    expect(
      await findSceneCaptionCues({
        workspaceId: fixture.workspaceId,
        sceneVersionId: fixture.sceneVersionId,
        audioGenerationId: replacement,
      }),
    ).toBeNull();
    expect(
      await findSceneCaptionCues({
        workspaceId: fixture.workspaceId,
        sceneVersionId: fixture.sceneVersionId,
        audioGenerationId: fixture.audioGenerationId,
      }),
    ).not.toBeNull();
  }, 30_000);

  it("refuses a second writer working from a stale revision", async () => {
    const fixture = await createFixture();
    await saveSceneCaptionCues({
      ...fixture,
      cues: CUES,
      expectedRevision: null,
    });
    const second = await saveSceneCaptionCues({
      ...fixture,
      cues: CUES,
      expectedRevision: 1,
    });
    expect(second.revision).toBe(2);
    await expect(
      saveSceneCaptionCues({ ...fixture, cues: CUES, expectedRevision: 1 }),
    ).rejects.toBeInstanceOf(CaptionCueConflictError);
  }, 30_000);

  it("refuses a first save when a correction already exists", async () => {
    const fixture = await createFixture();
    await saveSceneCaptionCues({
      ...fixture,
      cues: CUES,
      expectedRevision: null,
    });
    await expect(
      saveSceneCaptionCues({ ...fixture, cues: CUES, expectedRevision: null }),
    ).rejects.toBeInstanceOf(CaptionCueConflictError);
  }, 30_000);

  it("refuses narration belonging to another scene", async () => {
    const first = await createFixture();
    const second = await createFixture();
    await expect(
      saveSceneCaptionCues({
        workspaceId: first.workspaceId,
        projectId: first.projectId,
        sceneVersionId: first.sceneVersionId,
        audioGenerationId: second.audioGenerationId,
        cues: CUES,
        expectedRevision: null,
        userId: first.userId,
      }),
    ).rejects.toBeInstanceOf(CaptionCueConflictError);
  }, 30_000);

  it("refuses an empty correction at the database level", async () => {
    const fixture = await createFixture();
    await expect(
      getDatabase().insert(sceneCaptionCues).values({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        sceneId: fixture.sceneId,
        sceneVersionId: fixture.sceneVersionId,
        audioGenerationId: fixture.audioGenerationId,
        cues: [],
        updatedByUserId: fixture.userId,
      }),
    ).rejects.toThrow();
  }, 30_000);

  it("returns corrections for a whole project in one read", async () => {
    const fixture = await createFixture();
    await saveSceneCaptionCues({
      ...fixture,
      cues: CUES,
      expectedRevision: null,
    });
    const rows = await listSceneCaptionCues({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      audioGenerationIds: [fixture.audioGenerationId],
    });
    expect(rows).toHaveLength(1);
    expect(
      await listSceneCaptionCues({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        audioGenerationIds: [],
      }),
    ).toEqual([]);
  }, 30_000);

  it("discards a correction so the scene returns to derived timing", async () => {
    const fixture = await createFixture();
    await saveSceneCaptionCues({
      ...fixture,
      cues: CUES,
      expectedRevision: null,
    });
    expect(await clearSceneCaptionCues(fixture)).toBe(true);
    expect(
      await findSceneCaptionCues({
        workspaceId: fixture.workspaceId,
        sceneVersionId: fixture.sceneVersionId,
        audioGenerationId: fixture.audioGenerationId,
      }),
    ).toBeNull();
  }, 30_000);
});
