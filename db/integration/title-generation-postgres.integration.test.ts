import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  attachTitleGenerationTriggerRun,
  cancelTitleGeneration,
  completeTitleGeneration,
  createTitleGenerationReservation,
  failTitleGeneration,
  markTitleGenerationRunning,
  setTitleSuggestionFavorite,
} from "@/db/commands/title-generation-commands";
import { getDatabase } from "@/db/drizzle";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  projects,
  projectTitleSuggestions,
  titleGenerationRuns,
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
      clerkUserId: `title-gen-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Title Gen Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Title Gen Workspace",
      slug: `title-gen-${label}`,
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
      name: "Title Gen Project",
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
    platform: "youtube" as const,
    scriptVersionId: null,
    idempotencyKey: `title-gen-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    model: "integration-text-model",
    promptVersion: "title-generation-v1",
    finalPrompt: "Integration title prompt.",
    requestedOptionCount: 5,
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

describeDatabase("title generation ledger (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanup();
  });

  it(
    "reserves, reconciles with actual cost, and persists options",
    { timeout: 60_000 },
    async () => {
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, 12);
      await createTitleGenerationReservation(input);

      const [reserved] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.titleGenerationId, input.id));
      expect(reserved?.status).toBe("pending");
      expect(reserved?.reservedCostCents).toBe(12);
      expect(reserved?.operationType).toBe("title_generation");

      await completeTitleGeneration({
        titleGenerationRunId: input.id,
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        platform: "youtube",
        options: [
          {
            text: "Title One",
            rationale: "Curiosity gap",
            hookType: "curiosity-gap",
          },
          {
            text: "Title Two",
            rationale: "Concrete number",
            hookType: "number",
          },
        ],
        description: "A complete, publication-ready YouTube description.",
        tags: ["personal finance", "money habits"],
        inputTokens: 400,
        outputTokens: 120,
        actualCostCents: 8,
        providerRequestId: randomUUID(),
      });

      const [run] = await getDatabase()
        .select()
        .from(titleGenerationRuns)
        .where(eq(titleGenerationRuns.id, input.id));
      expect(run?.status).toBe("completed");
      expect(run?.resultOptionCount).toBe(2);
      expect(run?.generatedDescription).toContain("publication-ready");
      expect(run?.generatedTags).toEqual(["personal finance", "money habits"]);

      const [settled] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.titleGenerationId, input.id));
      expect(settled?.status).toBe("reconciled");
      expect(settled?.actualCostCents).toBe(8);

      const suggestions = await getDatabase()
        .select()
        .from(projectTitleSuggestions)
        .where(eq(projectTitleSuggestions.titleGenerationRunId, input.id));
      expect(suggestions).toHaveLength(2);
      expect(suggestions.map((s) => s.position).sort()).toEqual([0, 1]);

      const favorite = suggestions[0];
      if (favorite) {
        const result = await setTitleSuggestionFavorite({
          workspaceId: fixture.workspaceId,
          projectId: fixture.projectId,
          suggestionId: favorite.id,
          isFavorite: true,
        });
        expect(result.updated).toBe(true);
      }
    },
  );

  it("releases the reservation on failure", { timeout: 60_000 }, async () => {
    const fixture = await createFixture(1_000);
    const input = reservationInput(fixture, 12);
    await createTitleGenerationReservation(input);
    await failTitleGeneration({
      titleGenerationRunId: input.id,
      category: "provider_error",
      message: "The titles could not be generated.",
    });
    const [released] = await getDatabase()
      .select()
      .from(usageReservations)
      .where(eq(usageReservations.titleGenerationId, input.id));
    expect(released?.status).toBe("released");
    expect(released?.actualCostCents).toBe(0);
  });

  it(
    "cancels a queued run and releases its reservation",
    { timeout: 60_000 },
    async () => {
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, 12);
      await createTitleGenerationReservation(input);
      await attachTitleGenerationTriggerRun({
        titleGenerationRunId: input.id,
        triggerRunId: `run_${randomUUID()}`,
      });

      const cancelled = await cancelTitleGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        titleGenerationRunId: input.id,
      });
      expect(cancelled.cancelled).toBe(true);

      const [run] = await getDatabase()
        .select()
        .from(titleGenerationRuns)
        .where(eq(titleGenerationRuns.id, input.id));
      expect(run?.status).toBe("failed");
      expect(run?.errorCategory).toBe("cancelled");

      const [released] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.titleGenerationId, input.id));
      expect(released?.status).toBe("released");
    },
  );

  it(
    "does not cancel a run that is already running",
    { timeout: 60_000 },
    async () => {
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, 12);
      await createTitleGenerationReservation(input);
      await markTitleGenerationRunning({
        titleGenerationRunId: input.id,
        attemptCount: 1,
      });

      const cancelled = await cancelTitleGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        titleGenerationRunId: input.id,
      });
      expect(cancelled.cancelled).toBe(false);

      const [reservation] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.titleGenerationId, input.id));
      expect(reservation?.status).toBe("pending");
    },
  );

  it(
    "rejects a reservation that exceeds the project budget",
    { timeout: 60_000 },
    async () => {
      const fixture = await createFixture(10);
      await expect(
        createTitleGenerationReservation(reservationInput(fixture, 50)),
      ).rejects.toBeInstanceOf(BudgetExceededError);
      const rows = await getDatabase()
        .select()
        .from(titleGenerationRuns)
        .where(
          and(
            eq(titleGenerationRuns.workspaceId, fixture.workspaceId),
            eq(titleGenerationRuns.projectId, fixture.projectId),
          ),
        );
      expect(rows).toHaveLength(0);
    },
  );
});
