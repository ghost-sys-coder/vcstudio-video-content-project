import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  completeSceneAnalysis,
  createSceneAnalysisReservation,
  failSceneAnalysis,
  failSceneAnalysisWithUsage,
} from "@/db/commands/scene-commands";
import { getDatabase } from "@/db/drizzle";
import {
  projectScriptVersions,
  projects,
  sceneAnalysisRuns,
  sceneVersions,
  scenes,
  usageReservations,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import type { SceneContent } from "@/lib/schemas/scene";
import { NARRATION_FIDELITY_ERROR_CATEGORY } from "@/lib/scenes/scene-analysis-failure";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const APPROVED_SCRIPT =
  "Compound interest is quiet at first. Then it is not. Start early.";

type Fixture = {
  userId: string;
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
};

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

function scene(narrationText: string): SceneContent {
  return {
    narrationText,
    visualDescription: "A quiet desk with a notebook.",
    locationDescription: "Home office.",
    actionDescription: "The pen rests on the page.",
    cameraShot: "medium",
    cameraAngle: "eye level",
    cameraMotion: "static",
    emotionalTone: "calm",
    characterNames: [],
    propNames: [],
    continuityNotes: "",
    estimatedDurationMilliseconds: 4000,
  };
}

async function createFixture(): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const scriptVersionId = randomUUID();
  const label = randomUUID();
  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);
  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `fidelity-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Fidelity Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Fidelity Workspace",
      slug: `fidelity-${label}`,
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
      name: "Fidelity Project",
      status: "planning",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: 100_000,
      createdByUserId: userId,
    }),
  ]);
  await database.insert(projectScriptVersions).values({
    id: scriptVersionId,
    workspaceId,
    projectId,
    versionNumber: 1,
    content: APPROVED_SCRIPT,
    characterCount: APPROVED_SCRIPT.length,
    estimatedNarrationDurationSeconds: 12,
    createdByUserId: userId,
    status: "approved",
    approvedByUserId: userId,
    approvedAt: new Date(),
  });
  return { userId, workspaceId, projectId, scriptVersionId };
}

async function reserve(fixture: Fixture, estimatedCostCents: number) {
  const now = new Date();
  const analysisRunId = randomUUID();
  await createSceneAnalysisReservation({
    id: analysisRunId,
    reservationId: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    scriptVersionId: fixture.scriptVersionId,
    userId: fixture.userId,
    idempotencyKey: `fidelity-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    model: "integration-text-model",
    promptVersion: "scene-analysis-v2",
    finalPrompt: "Integration scene analysis prompt.",
    estimatedCostCents,
    expiresAt: new Date(now.getTime() + 15 * 60_000),
    budget: {
      workspaceDailyLimitCents: 100_000,
      workspaceMonthlyLimitCents: 100_000,
      dailyWindowStart: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      ),
      monthlyWindowStart: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      ),
    },
  });
  return analysisRunId;
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

describeDatabase("scene analysis fidelity ledger (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanup();
  });

  it(
    "records provider usage and preserves the previous plan when validation rejects paid output",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();

      // A first, faithful analysis establishes the active scene plan.
      const acceptedRunId = await reserve(fixture, 25);
      await completeSceneAnalysis({
        analysisRunId: acceptedRunId,
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        scriptVersionId: fixture.scriptVersionId,
        userId: fixture.userId,
        output: {
          scenes: [
            scene("Compound interest is quiet at first."),
            scene("Then it is not."),
            scene("Start early."),
          ],
        },
        inputTokens: 900,
        outputTokens: 400,
        actualCostCents: 24,
        providerRequestId: "resp_accepted",
        durationLimits: { minimum: 1000, maximum: 20_000 },
      });
      const acceptedScenes = await getDatabase()
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, fixture.projectId));
      expect(acceptedScenes).toHaveLength(3);

      // A second run is generated, billed, and then rejected by validation.
      const rejectedRunId = await reserve(fixture, 25);
      await failSceneAnalysisWithUsage({
        analysisRunId: rejectedRunId,
        category: NARRATION_FIDELITY_ERROR_CATEGORY,
        message: "Scene 2 skips 16 characters of the approved script.",
        providerRequestId: "resp_rejected",
        inputTokens: 950,
        outputTokens: 420,
        actualCostCents: 26,
      });

      const [rejectedRun] = await getDatabase()
        .select()
        .from(sceneAnalysisRuns)
        .where(eq(sceneAnalysisRuns.id, rejectedRunId));
      expect(rejectedRun?.status).toBe("failed");
      expect(rejectedRun?.errorCategory).toBe(
        NARRATION_FIDELITY_ERROR_CATEGORY,
      );
      expect(rejectedRun?.safeErrorMessage).toContain("skips 16 characters");
      expect(rejectedRun?.providerRequestId).toBe("resp_rejected");
      expect(rejectedRun?.inputTokens).toBe(950);
      expect(rejectedRun?.outputTokens).toBe(420);
      expect(rejectedRun?.actualCostCents).toBe(26);

      // The money is reconciled, not released: the provider was paid.
      const [rejectedReservation] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.analysisRunId, rejectedRunId));
      expect(rejectedReservation?.status).toBe("reconciled");
      expect(rejectedReservation?.actualCostCents).toBe(26);

      // The previously usable plan survives untouched.
      const scenesAfterRejection = await getDatabase()
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, fixture.projectId));
      expect(scenesAfterRejection).toHaveLength(3);
      expect(
        scenesAfterRejection.every(
          (row) => row.analysisRunId === acceptedRunId,
        ),
      ).toBe(true);
      const versions = await getDatabase()
        .select()
        .from(sceneVersions)
        .where(eq(sceneVersions.projectId, fixture.projectId));
      expect(versions).toHaveLength(3);
      expect(versions.map((row) => row.narrationText).sort()).toEqual(
        [
          "Compound interest is quiet at first.",
          "Start early.",
          "Then it is not.",
        ].sort(),
      );
    },
  );

  it(
    "still releases the reservation at zero when nothing was generated",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const runId = await reserve(fixture, 25);
      await failSceneAnalysis({
        analysisRunId: runId,
        category: "trigger_error",
        message: "Scene analysis could not be queued.",
      });

      const [run] = await getDatabase()
        .select()
        .from(sceneAnalysisRuns)
        .where(eq(sceneAnalysisRuns.id, runId));
      expect(run?.status).toBe("failed");
      expect(run?.actualCostCents).toBeNull();
      expect(run?.providerRequestId).toBeNull();

      const [reservation] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.analysisRunId, runId));
      expect(reservation?.status).toBe("released");
      expect(reservation?.actualCostCents).toBe(0);
    },
  );

  it(
    "keeps rejected runs scoped to their own workspace and project",
    { timeout: 90_000 },
    async () => {
      const own = await createFixture();
      const other = await createFixture();
      const runId = await reserve(own, 25);
      await failSceneAnalysisWithUsage({
        analysisRunId: runId,
        category: NARRATION_FIDELITY_ERROR_CATEGORY,
        message: "Scene 1 narration does not appear in the approved script.",
        providerRequestId: "resp_scoped",
        inputTokens: 100,
        outputTokens: 50,
        actualCostCents: 3,
      });

      const foreign = await getDatabase()
        .select()
        .from(sceneAnalysisRuns)
        .where(
          and(
            eq(sceneAnalysisRuns.id, runId),
            eq(sceneAnalysisRuns.workspaceId, other.workspaceId),
          ),
        );
      expect(foreign).toHaveLength(0);

      const [mine] = await getDatabase()
        .select()
        .from(sceneAnalysisRuns)
        .where(
          and(
            eq(sceneAnalysisRuns.id, runId),
            eq(sceneAnalysisRuns.workspaceId, own.workspaceId),
          ),
        );
      expect(mine?.actualCostCents).toBe(3);
      const otherScenes = await getDatabase()
        .select()
        .from(scenes)
        .where(eq(scenes.projectId, other.projectId));
      expect(otherScenes).toHaveLength(0);
    },
  );
});
