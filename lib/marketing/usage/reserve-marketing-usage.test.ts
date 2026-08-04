import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const committedSpend = vi.hoisted(() => ({
  pipelineDaily: 0,
  pipelineMonthly: 0,
  marketingDaily: 0,
  marketingMonthly: 0,
}));
const budget = vi.hoisted(() => ({
  dailyBudgetCents: 1000,
  monthlyBudgetCents: 10_000,
}));
const settings = vi.hoisted(() => ({
  monthlyMarketingBudgetCents: null as number | null,
}));
const existingRun = vi.hoisted(() => ({
  value: null as { run: { id: string }; reservationId: string } | null,
}));
const inserted = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
const executed = vi.hoisted(() => ({ statements: [] as unknown[] }));

vi.mock("@/lib/env/server", () => ({
  getSceneAnalysisEnvironment: () => ({
    GENERATION_RESERVATION_EXPIRY_MINUTES: 30,
  }),
}));
vi.mock("@/lib/budgets/workspace-budget", () => ({
  loadEffectiveWorkspaceBudget: async () => budget,
}));
vi.mock("@/lib/marketing/marketing-settings-view", () => ({
  loadMarketingSettings: async () => settings,
}));
vi.mock("@/db/repositories/marketing-usage.repository", () => ({
  findMarketingRunByIdempotencyKey: async () => existingRun.value,
}));

// The reservation asks this module for two windows — start-of-day and
// start-of-month — and the difference between the two answers is what lets the
// daily and monthly ceilings be tested apart. `now` is fixed mid-month below so
// the two windows never land on the same date.
vi.mock("@/lib/budgets/committed-spend", () => ({
  getWorkspaceCommittedSpend: async ({ since }: { since: Date }) => {
    const monthly = since.getUTCDate() === 1;
    const pipeline = monthly
      ? committedSpend.pipelineMonthly
      : committedSpend.pipelineDaily;
    const marketing = monthly
      ? committedSpend.marketingMonthly
      : committedSpend.marketingDaily;
    return {
      projectPipelineCents: pipeline,
      marketingCents: marketing,
      totalCents: pipeline + marketing,
    };
  },
  getMarketingCommittedSpend: async () => committedSpend.marketingMonthly,
}));

vi.mock("@/db/drizzle", () => ({
  getDatabase: () => ({
    execute: async (statement: unknown) => {
      executed.statements.push(statement);
    },
    insert: () => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          inserted.rows.push(row);
          return [{ id: `id-${inserted.rows.length}`, ...row }];
        },
      }),
    }),
  }),
}));

import { MarketingBudgetExceededError } from "@/lib/domain/errors";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";

const NOW = new Date("2026-08-15T12:00:00.000Z");

function reserve(estimatedCostCents: number) {
  return reserveMarketingUsage({
    workspaceId: "11111111-1111-4111-8111-111111111111",
    operation: "document_summary",
    estimatedCostCents,
    idempotencyKey: "key-1",
    now: NOW,
  });
}

beforeEach(() => {
  committedSpend.pipelineDaily = 0;
  committedSpend.pipelineMonthly = 0;
  committedSpend.marketingDaily = 0;
  committedSpend.marketingMonthly = 0;
  budget.dailyBudgetCents = 1000;
  budget.monthlyBudgetCents = 10_000;
  settings.monthlyMarketingBudgetCents = null;
  existingRun.value = null;
  inserted.rows = [];
  executed.statements = [];
});

describe("reserveMarketingUsage", () => {
  it("creates a run and a reservation when the workspace is within budget", async () => {
    const result = await reserve(50);
    expect(result.created).toBe(true);
    expect(inserted.rows).toHaveLength(2);
  });

  it("takes the advisory lock before deciding", async () => {
    // Without the lock two concurrent requests each read the pre-spend total and
    // both pass a limit only one of them fits under.
    await reserve(50);
    expect(executed.statements).toHaveLength(1);
  });

  it("returns the original run for a replayed idempotency key without reserving again", async () => {
    existingRun.value = { run: { id: "run-original" }, reservationId: "res-1" };
    const result = await reserve(50);
    expect(result).toEqual({
      runId: "run-original",
      reservationId: "res-1",
      created: false,
    });
    expect(inserted.rows).toHaveLength(0);
  });

  /**
   * The combined-budget test.
   *
   * Spend to the daily limit in the **video pipeline**, then ask marketing for
   * anything at all. If this passes, `committed-spend.ts` is being consulted; if
   * it fails, each ledger is reading only its own table and the workspace can
   * spend its daily allowance twice.
   */
  it("refuses marketing spend once the video pipeline has used the daily budget", async () => {
    committedSpend.pipelineDaily = 1000;
    committedSpend.pipelineMonthly = 1000;
    await expect(reserve(1)).rejects.toThrow(MarketingBudgetExceededError);
    expect(inserted.rows).toHaveLength(0);
  });

  it("names the daily scope so the UI can say which limit was hit", async () => {
    committedSpend.pipelineDaily = 999;
    committedSpend.pipelineMonthly = 999;
    await expect(reserve(2)).rejects.toMatchObject({
      scope: "workspace_daily",
    });
  });

  it("refuses when the monthly budget would be passed", async () => {
    budget.dailyBudgetCents = 1_000_000;
    committedSpend.pipelineMonthly = 10_000;
    await expect(reserve(1)).rejects.toMatchObject({
      scope: "workspace_monthly",
    });
  });

  it("refuses when the marketing sub-cap would be passed even with workspace budget left", async () => {
    settings.monthlyMarketingBudgetCents = 200;
    committedSpend.marketingMonthly = 200;
    await expect(reserve(1)).rejects.toMatchObject({
      scope: "marketing_monthly",
    });
  });

  it("allows spend that exactly reaches a limit", async () => {
    // The check is `>`, not `>=`: a budget of 1000 must be spendable down to
    // zero, or the last cent of every budget is unreachable.
    committedSpend.pipelineDaily = 900;
    committedSpend.pipelineMonthly = 900;
    await expect(reserve(100)).resolves.toMatchObject({ created: true });
  });

  it("ignores the marketing sub-cap when none is set", async () => {
    settings.monthlyMarketingBudgetCents = null;
    committedSpend.marketingMonthly = 5_000;
    committedSpend.pipelineMonthly = 0;
    await expect(reserve(10)).resolves.toMatchObject({ created: true });
  });

  it("records the reserved amount on both rows so preflight can compare them", async () => {
    await reserve(42);
    const [run, reservation] = inserted.rows;
    expect(run?.estimatedCostCents).toBe(42);
    expect(reservation?.reservedCostCents).toBe(42);
  });
});
