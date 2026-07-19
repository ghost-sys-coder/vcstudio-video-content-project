import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createVideoRenderReservation } from "@/db/commands/video-render-commands";
import { upsertWorkspaceBudgetSettings } from "@/db/commands/budget-settings.command";
import { getWorkspaceBudgetSettings } from "@/db/repositories/budget-settings.repository";
import { listAuditLogEvents } from "@/db/repositories/audit-log.repository";
import { listUsageLedgerEntries } from "@/db/repositories/usage-ledger.repository";
import { getWorkspaceUsageSummary } from "@/db/repositories/usage-summary.repository";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { getDatabase } from "@/db/drizzle";
import { BudgetExceededError } from "@/lib/domain/errors";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";
import { projects, users, workspaceMembers, workspaces } from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

type Fixture = { userId: string; workspaceId: string; projectId: string };
const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

async function createFixture(): Promise<Fixture> {
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
      clerkUserId: `usage-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Phase 10 Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Phase 10 Workspace",
      slug: `usage-integration-${label}`,
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
      name: "Phase 10 Project",
      status: "readyToRender",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: 1_000,
      createdByUserId: userId,
    }),
  ]);

  return { userId, workspaceId, projectId };
}

function timelineSnapshot(): RenderTimelineSnapshot {
  return {
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    totalDurationMilliseconds: 5_000,
    totalFrames: 150,
    includeCaptions: true,
    includeWatermark: false,
    captionStyle: DEFAULT_CAPTION_STYLE,
    scenes: [
      {
        sceneId: randomUUID(),
        sceneNumber: 1,
        startMilliseconds: 0,
        endMilliseconds: 5_000,
        startFrame: 0,
        endFrame: 150,
        durationFrames: 150,
        cameraMotion: "zoomIn",
        transition: "cut",
        image: { objectKey: "img-key", width: 1536, height: 1024 },
        audio: {
          objectKey: "aud-key",
          durationMilliseconds: 5_000,
          format: "mp3",
        },
        captions: [],
      },
    ],
  };
}

function reservationInput(
  fixture: Fixture,
  overrides: { estimatedCostCents?: number; dailyLimitCents?: number } = {},
) {
  const now = new Date();
  return {
    renderId: randomUUID(),
    reservationId: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    requestNonce: randomUUID(),
    idempotencyKey: `render-idem-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    preset: "landscape_1080p",
    aspectRatio: "16:9" as const,
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    includeCaptions: true,
    includeWatermark: false,
    sceneCount: 1,
    captionCount: 0,
    durationMilliseconds: 5_000,
    totalFrames: 150,
    timelineSnapshot: timelineSnapshot(),
    estimatedCostCents: overrides.estimatedCostCents ?? 5,
    requestedByUserId: fixture.userId,
    expiresAt: new Date(now.getTime() + 60_000),
    budget: {
      workspaceDailyLimitCents: overrides.dailyLimitCents ?? 500,
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

const settings = {
  dailyBudgetCents: 300,
  monthlyBudgetCents: 4_000,
  manualConfirmationThresholdCents: 250,
  maxImagesPerBatch: 10,
  maxScenesPerAudioBatch: null,
  maxRenderDurationSeconds: null,
  maxRetryAttempts: 1,
};

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

describeDatabase("Phase 10 usage, budgets, and audit invariants", () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL must be set for the integration suite.");
  });
  afterAll(cleanup);

  it("upserts editable budgets and records audit events", async () => {
    const fixture = await createFixture();
    const saved = await upsertWorkspaceBudgetSettings({
      workspaceId: fixture.workspaceId,
      actorUserId: fixture.userId,
      settings,
    });
    expect(saved.dailyBudgetCents).toBe(300);
    expect(saved.maxImagesPerBatch).toBe(10);

    const stored = await getWorkspaceBudgetSettings({
      workspaceId: fixture.workspaceId,
    });
    expect(stored?.manualConfirmationThresholdCents).toBe(250);

    const audit = await listAuditLogEvents({
      workspaceId: fixture.workspaceId,
      page: 1,
      pageSize: 20,
    });
    const actions = audit.items.map((entry) => entry.action);
    expect(actions).toContain("budget_changed");
    expect(actions).toContain("limits_changed");
  });

  it("resolves the edited budget and enforces it on reservation", async () => {
    const fixture = await createFixture();
    await upsertWorkspaceBudgetSettings({
      workspaceId: fixture.workspaceId,
      actorUserId: fixture.userId,
      settings: { ...settings, dailyBudgetCents: 5, monthlyBudgetCents: 5 },
    });

    const budget = await loadEffectiveWorkspaceBudget({
      workspaceId: fixture.workspaceId,
    });
    expect(budget.dailyBudgetCents).toBe(5);

    await expect(
      createVideoRenderReservation(
        reservationInput(fixture, {
          estimatedCostCents: 6,
          dailyLimitCents: budget.dailyBudgetCents,
        }),
      ),
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });

  it("surfaces a reservation in the unified ledger and summary", async () => {
    const fixture = await createFixture();
    const result = await createVideoRenderReservation(
      reservationInput(fixture, { estimatedCostCents: 7 }),
    );
    expect(result.created).toBe(true);

    const ledger = await listUsageLedgerEntries({
      workspaceId: fixture.workspaceId,
      page: 1,
      pageSize: 20,
    });
    expect(ledger.total).toBe(1);
    const entry = ledger.items[0];
    expect(entry.operationType).toBe("video_render");
    expect(entry.provider).toBe("remotion");
    expect(entry.requestedByUserId).toBe(fixture.userId);
    expect(entry.reservedCostCents).toBe(7);
    expect(entry.status).toBe("pending");
    expect(entry.settledAt).toBeNull();

    const summary = await getWorkspaceUsageSummary({
      workspaceId: fixture.workspaceId,
    });
    expect(summary.pendingReservedCents).toBe(7);
    expect(
      summary.byOperation.find((row) => row.operationType === "video_render")
        ?.committedCents,
    ).toBe(7);
    expect(
      summary.byProject.some((row) => row.projectId === fixture.projectId),
    ).toBe(true);
  });

  it("isolates ledger and audit reads across workspaces", async () => {
    const first = await createFixture();
    const second = await createFixture();
    await createVideoRenderReservation(
      reservationInput(first, { estimatedCostCents: 4 }),
    );
    await upsertWorkspaceBudgetSettings({
      workspaceId: first.workspaceId,
      actorUserId: first.userId,
      settings,
    });

    const ledger = await listUsageLedgerEntries({
      workspaceId: second.workspaceId,
      page: 1,
      pageSize: 20,
    });
    expect(ledger.total).toBe(0);

    const audit = await listAuditLogEvents({
      workspaceId: second.workspaceId,
      page: 1,
      pageSize: 20,
    });
    expect(audit.total).toBe(0);
  });
});
