import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  appendProductionRunEvent,
  cancelProductionRun,
  claimProductionRunRunning,
  createProductionRun,
  finishProductionRun,
  holdProductionRun,
  ProductionRunInFlightError,
  recordProductionRunGateResults,
  resumeProductionRun,
  updateProductionRunCursor,
} from "@/db/commands/production-run-commands";
import { getDatabase } from "@/db/drizzle";
import {
  findOpenProductionRun,
  listProductionRunEvents,
  listProductionRunGateResults,
} from "@/db/repositories/production-runs.repository";
import { projects, users, workspaceMembers, workspaces } from "@/db/schema";
import { defaultProductionRunPolicy } from "@/lib/production-runs/production-run-policy";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

async function createFixture() {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const label = randomUUID();
  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);
  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `production-run-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Production Run Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Production Run Workspace",
      slug: `production-run-${label}`,
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
      name: "Production Run Project",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en-US",
      maximumBudgetCents: 1000,
      createdByUserId: userId,
    }),
  ]);
  return { userId, workspaceId, projectId };
}

afterAll(async () => {
  if (!enabled) return;
  const database = getDatabase();
  if (fixtureWorkspaceIds.size)
    await database
      .delete(workspaces)
      .where(inArray(workspaces.id, [...fixtureWorkspaceIds]));
  for (const userId of fixtureUserIds)
    await database.delete(users).where(eq(users.id, userId));
});

describeDatabase("production runs (PostgreSQL)", () => {
  it("allows one open run per project and refuses a second", async () => {
    const fixture = await createFixture();
    const policy = defaultProductionRunPolicy({ maximumCostCents: 500 });
    const first = await createProductionRun({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      requestedByUserId: fixture.userId,
      policy,
      stage: "script",
    });
    expect(first.status).toBe("queued");
    await expect(
      createProductionRun({
        id: randomUUID(),
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        requestedByUserId: fixture.userId,
        policy,
        stage: "script",
      }),
    ).rejects.toBeInstanceOf(ProductionRunInFlightError);
    expect(
      (
        await findOpenProductionRun({
          workspaceId: fixture.workspaceId,
          projectId: fixture.projectId,
        })
      )?.id,
    ).toBe(first.id);

    // Cancelling frees the slot; a cancelled run is terminal.
    expect(
      (
        await cancelProductionRun({
          workspaceId: fixture.workspaceId,
          runId: first.id,
        })
      )?.status,
    ).toBe("cancelled");
    expect(
      await cancelProductionRun({
        workspaceId: fixture.workspaceId,
        runId: first.id,
      }),
    ).toBeNull();
    const second = await createProductionRun({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      requestedByUserId: fixture.userId,
      policy,
      stage: "script",
    });
    expect(second.id).not.toBe(first.id);
  });

  it("moves through claim, cursor updates, hold, resume and finish with status guards", async () => {
    const fixture = await createFixture();
    const scope = { workspaceId: fixture.workspaceId };
    const run = await createProductionRun({
      id: randomUUID(),
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      requestedByUserId: fixture.userId,
      policy: defaultProductionRunPolicy({ maximumCostCents: 500 }),
      stage: "script",
    });

    // Only a running run can hold or move its cursor.
    expect(
      await holdProductionRun({ ...scope, runId: run.id, reason: "x" }),
    ).toBeNull();
    const claimed = await claimProductionRunRunning({
      ...scope,
      runId: run.id,
    });
    expect(claimed?.status).toBe("running");
    expect(claimed?.startedAt).not.toBeNull();

    const moved = await updateProductionRunCursor({
      ...scope,
      runId: run.id,
      stage: "scenes",
      attempts: { script: 1 },
      stageReferences: { scriptGenerationRunId: randomUUID() },
      spentCostCents: 7,
    });
    expect(moved?.stage).toBe("scenes");
    expect(moved?.attempts).toEqual({ script: 1 });
    expect(moved?.spentCostCents).toBe(7);

    await appendProductionRunEvent({
      ...scope,
      runId: run.id,
      stage: "scenes",
      kind: "stage_started",
      message: "Working on scenes.",
    });
    await recordProductionRunGateResults({
      ...scope,
      runId: run.id,
      stage: "script",
      results: [
        {
          subject: "script",
          subjectId: "draft",
          label: "The script",
          verdict: "pass",
          score: 90,
          reasons: ["ok"],
          accepted: true,
        },
      ],
    });
    expect(
      (await listProductionRunEvents({ ...scope, runId: run.id })).map(
        (e) => e.kind,
      ),
    ).toEqual(["stage_started"]);
    expect(
      (await listProductionRunGateResults({ ...scope, runId: run.id }))[0]
        ?.accepted,
    ).toBe(true);

    const held = await holdProductionRun({
      ...scope,
      runId: run.id,
      reason: "Needs a voice.",
    });
    expect(held?.status).toBe("held");
    // A held run still owns the project.
    expect(
      (
        await findOpenProductionRun({
          workspaceId: fixture.workspaceId,
          projectId: fixture.projectId,
        })
      )?.id,
    ).toBe(run.id);
    // And cannot be claimed as running until resumed.
    expect(
      await claimProductionRunRunning({ ...scope, runId: run.id }),
    ).toBeNull();
    const resumed = await resumeProductionRun({ ...scope, runId: run.id });
    expect(resumed?.status).toBe("queued");
    expect(resumed?.holdReason).toBeNull();
    expect(await resumeProductionRun({ ...scope, runId: run.id })).toBeNull();

    expect(
      (await claimProductionRunRunning({ ...scope, runId: run.id }))?.status,
    ).toBe("running");
    const finished = await finishProductionRun({
      ...scope,
      runId: run.id,
      status: "ready_for_review",
    });
    expect(finished?.status).toBe("ready_for_review");
    expect(finished?.completedAt).not.toBeNull();
    // Terminal: nothing moves it again, and the project is free.
    expect(
      await updateProductionRunCursor({
        ...scope,
        runId: run.id,
        stage: "release",
      }),
    ).toBeNull();
    expect(
      await findOpenProductionRun({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
      }),
    ).toBeNull();
  });
});
