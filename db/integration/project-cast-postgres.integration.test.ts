import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  addCharacterToProjectCast,
  applyCastToScenes,
  removeCharacterFromProjectCast,
} from "@/db/commands/project-characters.command";
import { listProjectCast } from "@/db/repositories/project-characters.repository";
import { getDatabase } from "@/db/drizzle";
import {
  characters,
  projects,
  projectScriptVersions,
  sceneAnalysisRuns,
  sceneVersionCharacters,
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
  scene1Id: string;
  scene1VersionId: string;
  scene2Id: string;
  scene2VersionId: string;
  kaneId: string;
  diazId: string;
};

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

function characterValues(input: {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  slug: string;
}): typeof characters.$inferInsert {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    name: input.name,
    slug: input.slug,
    status: "active",
    createdByUserId: input.userId,
  };
}

function sceneVersionValues(input: {
  id: string;
  workspaceId: string;
  projectId: string;
  sceneId: string;
  userId: string;
  characterNames: string[];
}): typeof sceneVersions.$inferInsert {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    sceneId: input.sceneId,
    versionNumber: 1,
    narrationText: "An isolated integration narration.",
    visualDescription: "A clean editorial illustration.",
    locationDescription: "A neutral studio.",
    actionDescription: "A presenter explains one concept.",
    cameraShot: "medium",
    cameraAngle: "eye-level",
    cameraMotion: "static",
    emotionalTone: "confident",
    characterNames: input.characterNames,
    propNames: [],
    continuityNotes: "Maintain the same composition.",
    estimatedDurationMilliseconds: 5_000,
    startTimeMilliseconds: 0,
    endTimeMilliseconds: 5_000,
    createdByUserId: input.userId,
  };
}

async function createFixture(): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const scriptVersionId = randomUUID();
  const analysisRunId = randomUUID();
  const scene1Id = randomUUID();
  const scene1VersionId = randomUUID();
  const scene2Id = randomUUID();
  const scene2VersionId = randomUUID();
  const kaneId = randomUUID();
  const diazId = randomUUID();
  const label = randomUUID();
  const now = new Date();

  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);

  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `cast-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Cast Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Cast Workspace",
      slug: `cast-integration-${label}`,
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
      name: "Cast Project",
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
      content: "An isolated integration narration.",
      characterCount: 33,
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
      idempotencyKey: `cast-analysis-${label}`,
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
      id: scene1Id,
      workspaceId,
      projectId,
      scriptVersionId,
      analysisRunId,
      sceneNumber: 1,
      status: "approved",
      currentVersion: 1,
    }),
    database.insert(scenes).values({
      id: scene2Id,
      workspaceId,
      projectId,
      scriptVersionId,
      analysisRunId,
      sceneNumber: 2,
      status: "approved",
      currentVersion: 1,
    }),
    database.insert(sceneVersions).values(
      sceneVersionValues({
        id: scene1VersionId,
        workspaceId,
        projectId,
        sceneId: scene1Id,
        userId,
        characterNames: ["Detective Kane"],
      }),
    ),
    database.insert(sceneVersions).values(
      sceneVersionValues({
        id: scene2VersionId,
        workspaceId,
        projectId,
        sceneId: scene2Id,
        userId,
        characterNames: ["Officer Diaz", "The Detective Kane"],
      }),
    ),
    database.insert(characters).values(
      characterValues({
        id: kaneId,
        workspaceId,
        userId,
        name: "Detective Kane",
        slug: `detective-kane-${label}`,
      }),
    ),
    database.insert(characters).values(
      characterValues({
        id: diazId,
        workspaceId,
        userId,
        name: "Officer Diaz",
        slug: `officer-diaz-${label}`,
      }),
    ),
  ]);

  return {
    userId,
    workspaceId,
    projectId,
    scene1Id,
    scene1VersionId,
    scene2Id,
    scene2VersionId,
    kaneId,
    diazId,
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

async function listAssignments(fixture: Fixture) {
  return getDatabase()
    .select()
    .from(sceneVersionCharacters)
    .where(
      and(
        eq(sceneVersionCharacters.workspaceId, fixture.workspaceId),
        eq(sceneVersionCharacters.projectId, fixture.projectId),
      ),
    );
}

describeDatabase("project cast (postgres)", () => {
  beforeAll(async () => {
    if (!enabled) return;
  });

  afterAll(async () => {
    if (enabled) await cleanupFixtures();
  });

  it(
    "adds cast members idempotently and isolates by workspace",
    { timeout: 60_000 },
    async () => {
      const fixture = await createFixture();
      await addCharacterToProjectCast({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        characterId: fixture.kaneId,
        userId: fixture.userId,
      });
      await addCharacterToProjectCast({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        characterId: fixture.kaneId,
        userId: fixture.userId,
      });

      const cast = await listProjectCast({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
      });
      expect(cast.map((member) => member.characterId)).toEqual([
        fixture.kaneId,
      ]);

      const otherWorkspaceCast = await listProjectCast({
        workspaceId: randomUUID(),
        projectId: fixture.projectId,
      });
      expect(otherWorkspaceCast).toEqual([]);

      await removeCharacterFromProjectCast({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        characterId: fixture.kaneId,
      });
      const afterRemoval = await listProjectCast({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
      });
      expect(afterRemoval).toEqual([]);
    },
  );

  it(
    "applies the cast to matched scenes, preserves manual assignments, and is idempotent",
    { timeout: 60_000 },
    async () => {
      const fixture = await createFixture();
      // A pre-existing manual assignment that bulk apply must never remove.
      await getDatabase().insert(sceneVersionCharacters).values({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        sceneVersionId: fixture.scene1VersionId,
        characterId: fixture.diazId,
        assignedByUserId: fixture.userId,
      });

      await addCharacterToProjectCast({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        characterId: fixture.kaneId,
        userId: fixture.userId,
      });
      await addCharacterToProjectCast({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        characterId: fixture.diazId,
        userId: fixture.userId,
      });

      const first = await applyCastToScenes({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        mode: "matched",
        userId: fixture.userId,
      });
      // scene1 → Kane (Diaz already manual); scene2 → Kane + Diaz.
      expect(first.scenesAffected).toBe(2);
      expect(first.assignmentsCreated).toBe(3);

      const assignments = await listAssignments(fixture);
      // 1 manual + 3 created = 4 total rows.
      expect(assignments.length).toBe(4);
      const scene1 = assignments
        .filter((row) => row.sceneVersionId === fixture.scene1VersionId)
        .map((row) => row.characterId)
        .sort();
      expect(scene1).toEqual([fixture.diazId, fixture.kaneId].sort());

      const second = await applyCastToScenes({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        mode: "matched",
        userId: fixture.userId,
      });
      expect(second.assignmentsCreated).toBe(0);
      expect((await listAssignments(fixture)).length).toBe(4);
    },
  );
});
