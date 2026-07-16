import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectScriptVersions,
  projects,
  sceneAnalysisRuns,
  scenes,
  sceneVersions,
  usageReservations,
} from "@/db/schema";
import type { SceneContent, SceneAnalysisOutput } from "@/lib/schemas/scene";
import { calculateSceneTimings } from "@/lib/domain/scene-timing";
import {
  findLatestCompletedSceneAnalysisRun,
  listCurrentScenes,
} from "@/db/repositories/scenes.repository";
import { findProjectScriptVersion } from "@/db/repositories/projects.repository";

export async function approveScriptVersion(input: {
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
  userId: string;
}) {
  const target = await findProjectScriptVersion({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    versionId: input.scriptVersionId,
  });
  if (!target) throw new Error("Script version not found.");
  const now = new Date();
  await getDatabase().batch([
    getDatabase()
      .update(projectScriptVersions)
      .set({ status: "superseded", approvedByUserId: null, approvedAt: null })
      .where(
        and(
          eq(projectScriptVersions.workspaceId, input.workspaceId),
          eq(projectScriptVersions.projectId, input.projectId),
          ne(projectScriptVersions.id, input.scriptVersionId),
          eq(projectScriptVersions.status, "approved"),
        ),
      ),
    getDatabase()
      .update(projectScriptVersions)
      .set({
        status: "approved",
        approvedByUserId: input.userId,
        approvedAt: now,
      })
      .where(
        and(
          eq(projectScriptVersions.workspaceId, input.workspaceId),
          eq(projectScriptVersions.projectId, input.projectId),
          eq(projectScriptVersions.id, input.scriptVersionId),
        ),
      ),
  ]);
}

export async function createSceneAnalysisReservation(input: {
  id: string;
  reservationId: string;
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
  userId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  model: string;
  promptVersion: string;
  finalPrompt: string;
  estimatedCostCents: number;
  expiresAt: Date;
}) {
  await getDatabase().batch([
    getDatabase().insert(sceneAnalysisRuns).values({
      id: input.id,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      scriptVersionId: input.scriptVersionId,
      requestedByUserId: input.userId,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      model: input.model,
      promptVersion: input.promptVersion,
      finalPrompt: input.finalPrompt,
      estimatedCostCents: input.estimatedCostCents,
    }),
    getDatabase().insert(usageReservations).values({
      id: input.reservationId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      analysisRunId: input.id,
      reservedCostCents: input.estimatedCostCents,
      expiresAt: input.expiresAt,
    }),
  ]);
}

export async function attachTriggerRun(input: {
  analysisRunId: string;
  triggerRunId: string;
}) {
  await getDatabase()
    .update(sceneAnalysisRuns)
    .set({
      triggerRunId: input.triggerRunId,
      status: "queued",
      progressPercent: 5,
      updatedAt: new Date(),
    })
    .where(eq(sceneAnalysisRuns.id, input.analysisRunId));
}

export async function markSceneAnalysisRunning(
  analysisRunId: string,
  attemptCount: number,
) {
  await getDatabase()
    .update(sceneAnalysisRuns)
    .set({
      status: "running",
      progressPercent: 20,
      attemptCount,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sceneAnalysisRuns.id, analysisRunId));
}

export async function syncSceneAnalysisRunning(input: {
  analysisRunId: string;
  workspaceId: string;
  projectId: string;
}) {
  await getDatabase()
    .update(sceneAnalysisRuns)
    .set({
      status: "running",
      progressPercent: 20,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sceneAnalysisRuns.id, input.analysisRunId),
        eq(sceneAnalysisRuns.workspaceId, input.workspaceId),
        eq(sceneAnalysisRuns.projectId, input.projectId),
        eq(sceneAnalysisRuns.status, "queued"),
      ),
    );
}

export async function completeSceneAnalysis(input: {
  analysisRunId: string;
  workspaceId: string;
  projectId: string;
  scriptVersionId: string;
  userId: string;
  output: SceneAnalysisOutput;
  inputTokens: number;
  outputTokens: number;
  actualCostCents: number;
  providerRequestId: string;
  durationLimits: { minimum: number; maximum: number };
}) {
  const timedScenes = calculateSceneTimings(
    input.output.scenes,
    input.durationLimits,
  );
  const now = new Date();
  const sceneRows = timedScenes.map((_, index) => ({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    scriptVersionId: input.scriptVersionId,
    analysisRunId: input.analysisRunId,
    sceneNumber: index + 1,
  }));
  const versionRows = timedScenes.map((scene, index) => ({
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sceneId: sceneRows[index]!.id,
    versionNumber: 1,
    ...scene,
    createdByUserId: input.userId,
  }));
  await getDatabase().batch([
    getDatabase().insert(scenes).values(sceneRows),
    getDatabase().insert(sceneVersions).values(versionRows),
    getDatabase()
      .update(sceneAnalysisRuns)
      .set({
        status: "completed",
        progressPercent: 100,
        providerRequestId: input.providerRequestId,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        actualCostCents: input.actualCostCents,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(sceneAnalysisRuns.id, input.analysisRunId)),
    getDatabase()
      .update(usageReservations)
      .set({
        status: "reconciled",
        actualCostCents: input.actualCostCents,
        updatedAt: now,
      })
      .where(eq(usageReservations.analysisRunId, input.analysisRunId)),
    getDatabase()
      .update(projects)
      .set({ status: "planning", updatedAt: now })
      .where(
        and(
          eq(projects.workspaceId, input.workspaceId),
          eq(projects.id, input.projectId),
        ),
      ),
  ]);
}

export async function failSceneAnalysis(input: {
  analysisRunId: string;
  category: string;
  message: string;
}) {
  const now = new Date();
  await getDatabase().batch([
    getDatabase()
      .update(sceneAnalysisRuns)
      .set({
        status: "failed",
        errorCategory: input.category,
        safeErrorMessage: input.message,
        completedAt: now,
        updatedAt: now,
      })
      .where(eq(sceneAnalysisRuns.id, input.analysisRunId)),
    getDatabase()
      .update(usageReservations)
      .set({ status: "released", actualCostCents: 0, updatedAt: now })
      .where(
        and(
          eq(usageReservations.analysisRunId, input.analysisRunId),
          eq(usageReservations.status, "pending"),
        ),
      ),
  ]);
}

export async function updateScene(
  input: SceneContent & {
    workspaceId: string;
    projectId: string;
    sceneId: string;
    expectedVersion: number;
    userId: string;
  },
) {
  const currentRows = await listCurrentScenes(input);
  const targetIndex = currentRows.findIndex(
    ({ scene }) => scene.id === input.sceneId,
  );
  const target = currentRows[targetIndex];
  if (!target || target.scene.currentVersion !== input.expectedVersion)
    throw new Error("SCENE_REVISION_CONFLICT");
  let cursor = target.version.startTimeMilliseconds;
  const affected = currentRows.slice(targetIndex).map((row, index) => {
    const content = index === 0 ? input : row.version;
    const startTimeMilliseconds = cursor;
    const endTimeMilliseconds = cursor + content.estimatedDurationMilliseconds;
    cursor = endTimeMilliseconds;
    return {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sceneId: row.scene.id,
      versionNumber: row.scene.currentVersion + 1,
      narrationText: content.narrationText,
      visualDescription: content.visualDescription,
      locationDescription: content.locationDescription,
      actionDescription: content.actionDescription,
      cameraShot: content.cameraShot,
      cameraAngle: content.cameraAngle,
      cameraMotion: content.cameraMotion,
      emotionalTone: content.emotionalTone,
      characterNames: content.characterNames,
      propNames: content.propNames,
      continuityNotes: content.continuityNotes,
      estimatedDurationMilliseconds: content.estimatedDurationMilliseconds,
      startTimeMilliseconds,
      endTimeMilliseconds,
      createdByUserId: input.userId,
    };
  });
  const updates = affected.map((version) =>
    getDatabase()
      .update(scenes)
      .set({
        currentVersion: version.versionNumber,
        status: "review",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scenes.workspaceId, input.workspaceId),
          eq(scenes.projectId, input.projectId),
          eq(scenes.id, version.sceneId),
          eq(scenes.currentVersion, version.versionNumber - 1),
        ),
      ),
  );
  await getDatabase().batch([
    getDatabase().insert(sceneVersions).values(affected),
    ...updates,
  ]);
}

export async function approveScene(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  expectedVersion: number;
}) {
  const [scene] = await getDatabase()
    .update(scenes)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
        eq(scenes.id, input.sceneId),
        eq(scenes.currentVersion, input.expectedVersion),
      ),
    )
    .returning();
  if (!scene) throw new Error("SCENE_REVISION_CONFLICT");
}

export async function approveAllScenes(input: {
  workspaceId: string;
  projectId: string;
}) {
  const activeRun = await findLatestCompletedSceneAnalysisRun(input);
  if (!activeRun) throw new Error("No completed scene plan found.");
  const approved = await getDatabase()
    .update(scenes)
    .set({ status: "approved", updatedAt: new Date() })
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
        eq(scenes.analysisRunId, activeRun.id),
      ),
    )
    .returning({ id: scenes.id });
  if (!approved.length) throw new Error("No active scenes found.");
}
