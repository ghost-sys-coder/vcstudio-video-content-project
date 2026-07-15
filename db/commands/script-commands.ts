import "server-only";

import { and, count, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectScriptDrafts,
  projectScriptVersions,
  sceneAnalysisRuns,
} from "@/db/schema";
import { calculateScriptStatistics } from "@/lib/domain/script-statistics";
import { assertScriptVersionDeletable } from "@/lib/domain/script-version-deletion";
import {
  findProjectScriptDraft,
  findProjectScriptVersion,
  getLatestProjectScriptVersionNumber,
} from "@/db/repositories/projects.repository";

export async function saveScriptDraft(input: {
  workspaceId: string;
  projectId: string;
  content: string;
  revision: number;
  userId: string;
}) {
  const statistics = calculateScriptStatistics(input.content);
  const [draft] = await getDatabase()
    .update(projectScriptDrafts)
    .set({
      content: input.content,
      revision: input.revision + 1,
      characterCount: statistics.characterCount,
      estimatedNarrationDurationSeconds:
        statistics.estimatedNarrationDurationSeconds,
      updatedByUserId: input.userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectScriptDrafts.workspaceId, input.workspaceId),
        eq(projectScriptDrafts.projectId, input.projectId),
        eq(projectScriptDrafts.revision, input.revision),
      ),
    )
    .returning();
  if (!draft) throw new Error("SCRIPT_REVISION_CONFLICT");
  return draft;
}

export async function createScriptVersion(input: {
  workspaceId: string;
  projectId: string;
  revision: number;
  userId: string;
}) {
  const draft = await findProjectScriptDraft(input);
  if (!draft || draft.revision !== input.revision)
    throw new Error("SCRIPT_REVISION_CONFLICT");
  const versionNumber = (await getLatestProjectScriptVersionNumber(input)) + 1;
  const [version] = await getDatabase()
    .insert(projectScriptVersions)
    .values({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      versionNumber,
      content: draft.content,
      characterCount: draft.characterCount,
      estimatedNarrationDurationSeconds:
        draft.estimatedNarrationDurationSeconds,
      createdByUserId: input.userId,
    })
    .returning();
  if (!version) throw new Error("Script version creation failed.");
  return version;
}

export async function restoreScriptVersion(input: {
  workspaceId: string;
  projectId: string;
  versionId: string;
  revision: number;
  userId: string;
}) {
  const [draft, source, latest] = await Promise.all([
    findProjectScriptDraft(input),
    findProjectScriptVersion(input),
    getLatestProjectScriptVersionNumber(input),
  ]);
  if (!draft || draft.revision !== input.revision)
    throw new Error("SCRIPT_REVISION_CONFLICT");
  if (!source) throw new Error("Script version not found.");
  const versionId = crypto.randomUUID();
  await getDatabase().batch([
    getDatabase()
      .update(projectScriptDrafts)
      .set({
        content: source.content,
        revision: input.revision + 1,
        characterCount: source.characterCount,
        estimatedNarrationDurationSeconds:
          source.estimatedNarrationDurationSeconds,
        updatedByUserId: input.userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(projectScriptDrafts.workspaceId, input.workspaceId),
          eq(projectScriptDrafts.projectId, input.projectId),
          eq(projectScriptDrafts.revision, input.revision),
        ),
      ),
    getDatabase()
      .insert(projectScriptVersions)
      .values({
        id: versionId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        versionNumber: latest + 1,
        content: source.content,
        characterCount: source.characterCount,
        estimatedNarrationDurationSeconds:
          source.estimatedNarrationDurationSeconds,
        createdByUserId: input.userId,
        restoredFromVersionId: source.id,
      }),
  ]);
  return { versionId, revision: input.revision + 1 };
}

export async function deleteScriptVersion(input: {
  workspaceId: string;
  projectId: string;
  versionId: string;
  userId: string;
}) {
  const version = await findProjectScriptVersion(input);
  if (!version) throw new Error("SCRIPT_VERSION_NOT_FOUND");
  const [references] = await getDatabase()
    .select({ value: count() })
    .from(sceneAnalysisRuns)
    .where(
      and(
        eq(sceneAnalysisRuns.workspaceId, input.workspaceId),
        eq(sceneAnalysisRuns.projectId, input.projectId),
        eq(sceneAnalysisRuns.scriptVersionId, input.versionId),
      ),
    );
  assertScriptVersionDeletable({
    status: version.status,
    referenceCount: references?.value ?? 0,
  });
  const [deleted] = await getDatabase()
    .update(projectScriptVersions)
    .set({
      deletedAt: new Date(),
      deletedByUserId: input.userId,
    })
    .where(
      and(
        eq(projectScriptVersions.workspaceId, input.workspaceId),
        eq(projectScriptVersions.projectId, input.projectId),
        eq(projectScriptVersions.id, input.versionId),
        isNull(projectScriptVersions.deletedAt),
      ),
    )
    .returning({ id: projectScriptVersions.id });
  if (!deleted) throw new Error("SCRIPT_VERSION_NOT_FOUND");
}
