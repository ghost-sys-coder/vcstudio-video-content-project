import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  completeScriptGeneration,
  createScriptGenerationReservation,
  failScriptGeneration,
} from "@/db/commands/script-generation-commands";
import { getDatabase } from "@/db/drizzle";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  projects,
  scriptGenerationRuns,
  usageReservations,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

type Fixture = { userId: string; workspaceId: string; projectId: string };
const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

async function createFixture(projectBudgetCents: number): Promise<Fixture> {
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
      clerkUserId: `script-gen-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Script Gen Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Script Gen Workspace",
      slug: `script-gen-${label}`,
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
      name: "Script Gen Project",
      status: "planning",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: projectBudgetCents,
      createdByUserId: userId,
    }),
  ]);
  return { userId, workspaceId, projectId };
}

function reservationInput(fixture: Fixture, estimatedCostCents: number) {
  const now = new Date();
  return {
    id: randomUUID(),
    reservationId: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    userId: fixture.userId,
    idempotencyKey: `script-gen-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    model: "integration-text-model",
    promptVersion: "script-generation-v1",
    finalPrompt: "Integration script prompt.",
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
  };
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

describeDatabase("script generation ledger (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanup();
  });

  it(
    "reserves then reconciles with actual cost",
    { timeout: 60_000 },
    async () => {
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, 20);
      await createScriptGenerationReservation(input);

      const [reserved] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.scriptGenerationId, input.id));
      expect(reserved?.status).toBe("pending");
      expect(reserved?.reservedCostCents).toBe(20);
      expect(reserved?.operationType).toBe("script_generation");

      await completeScriptGeneration({
        scriptGenerationRunId: input.id,
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        generatedContent: "A generated narration script.",
        suggestedTitle: "A Strong Title",
        inputTokens: 500,
        outputTokens: 300,
        actualCostCents: 12,
        providerRequestId: randomUUID(),
      });

      const [run] = await getDatabase()
        .select()
        .from(scriptGenerationRuns)
        .where(eq(scriptGenerationRuns.id, input.id));
      expect(run?.status).toBe("completed");
      expect(run?.generatedContent).toBe("A generated narration script.");

      const [settled] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.scriptGenerationId, input.id));
      expect(settled?.status).toBe("reconciled");
      expect(settled?.actualCostCents).toBe(12);
    },
  );

  it("releases the reservation on failure", { timeout: 60_000 }, async () => {
    const fixture = await createFixture(1_000);
    const input = reservationInput(fixture, 20);
    await createScriptGenerationReservation(input);
    await failScriptGeneration({
      scriptGenerationRunId: input.id,
      category: "provider_error",
      message: "The script could not be generated.",
    });
    const [released] = await getDatabase()
      .select()
      .from(usageReservations)
      .where(eq(usageReservations.scriptGenerationId, input.id));
    expect(released?.status).toBe("released");
    expect(released?.actualCostCents).toBe(0);
  });

  it(
    "rejects a reservation that exceeds the project budget",
    { timeout: 60_000 },
    async () => {
      const fixture = await createFixture(10);
      await expect(
        createScriptGenerationReservation(reservationInput(fixture, 50)),
      ).rejects.toBeInstanceOf(BudgetExceededError);
      const rows = await getDatabase()
        .select()
        .from(scriptGenerationRuns)
        .where(
          and(
            eq(scriptGenerationRuns.workspaceId, fixture.workspaceId),
            eq(scriptGenerationRuns.projectId, fixture.projectId),
          ),
        );
      expect(rows).toHaveLength(0);
    },
  );
});
