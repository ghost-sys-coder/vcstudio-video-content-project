import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import {
  cancelVideoRender,
  claimVideoRenderRunning,
  completeVideoRender,
  createVideoRenderReservation,
  failVideoRender,
} from "@/db/commands/video-render-commands";
import {
  countTerminalVideoRendersForTimeline,
  findVideoRender,
  findVideoRenderReservation,
} from "@/db/repositories/video-render.repository";
import { getDatabase } from "@/db/drizzle";
import { BudgetExceededError } from "@/lib/domain/errors";
import type { RenderTimelineSnapshot } from "@/lib/render/render-timeline-snapshot";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";
import {
  projects,
  usageReservations,
  users,
  videoRenders,
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
};

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

async function createFixture(
  options: { maximumBudgetCents?: number } = {},
): Promise<Fixture> {
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
      clerkUserId: `render-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Phase 9 Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Phase 9 Workspace",
      slug: `render-integration-${label}`,
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
      name: "Phase 9 Project",
      status: "readyToRender",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: options.maximumBudgetCents ?? 1_000,
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
  overrides: Partial<{
    requestNonce: string;
    idempotencyKey: string;
    requestFingerprint: string;
    estimatedCostCents: number;
  }> = {},
) {
  const now = new Date();
  return {
    renderId: randomUUID(),
    reservationId: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    requestNonce: overrides.requestNonce ?? randomUUID(),
    idempotencyKey: overrides.idempotencyKey ?? `render-idem-${randomUUID()}`,
    requestFingerprint:
      overrides.requestFingerprint ?? randomUUID().replaceAll("-", ""),
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
      workspaceDailyLimitCents: 500,
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

describeDatabase("Phase 9 video render invariants", () => {
  beforeAll(() => {
    if (process.env.NODE_ENV === "production")
      throw new Error("Integration tests must not run against production.");
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is required for integration tests.");
  });
  afterEach(cleanup);
  afterAll(cleanup);

  it("reserves once and treats a duplicate request as idempotent", async () => {
    const fixture = await createFixture();
    const input = reservationInput(fixture);
    const first = await createVideoRenderReservation(input);
    const second = await createVideoRenderReservation(input);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.render.id).toBe(first.render.id);

    const reservations = await getDatabase()
      .select({ id: usageReservations.id })
      .from(usageReservations)
      .where(eq(usageReservations.videoRenderId, first.render.id));
    expect(reservations).toHaveLength(1);
  }, 30_000);

  it("rejects a render that exceeds the project budget", async () => {
    const fixture = await createFixture({ maximumBudgetCents: 3 });
    await expect(
      createVideoRenderReservation(
        reservationInput(fixture, { estimatedCostCents: 10 }),
      ),
    ).rejects.toBeInstanceOf(BudgetExceededError);

    const renders = await getDatabase()
      .select({ id: videoRenders.id })
      .from(videoRenders)
      .where(eq(videoRenders.projectId, fixture.projectId));
    expect(renders).toHaveLength(0);
  }, 30_000);

  it("cancels a queued render and releases its budget", async () => {
    const fixture = await createFixture();
    const reservation = await createVideoRenderReservation(
      reservationInput(fixture),
    );
    const result = await cancelVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(result.cancelled).toBe(true);
    expect(result.wasRunning).toBe(false);

    const render = await findVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(render?.status).toBe("cancelled");
    expect(render?.safeErrorMessage).toBe(
      "This render was cancelled before it started.",
    );
    const released = await findVideoRenderReservation({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(released?.status).toBe("released");
  }, 30_000);

  it("cancels a running render and releases its budget", async () => {
    const fixture = await createFixture();
    const reservation = await createVideoRenderReservation(
      reservationInput(fixture),
    );
    await claimVideoRenderRunning({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
      attemptNumber: 1,
      providerRequestId: randomUUID(),
    });

    const result = await cancelVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(result.cancelled).toBe(true);
    expect(result.wasRunning).toBe(true);

    const render = await findVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(render?.status).toBe("cancelled");
    expect(render?.actualCostCents).toBe(0);
    expect(render?.safeErrorMessage).toBe(
      "This render was cancelled while it was rendering.",
    );
    const released = await findVideoRenderReservation({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(released?.status).toBe("released");
    expect(released?.actualCostCents).toBe(0);
  }, 30_000);

  it("does not cancel a render that already succeeded", async () => {
    const fixture = await createFixture();
    const reservation = await createVideoRenderReservation(
      reservationInput(fixture),
    );
    await claimVideoRenderRunning({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
      attemptNumber: 1,
      providerRequestId: randomUUID(),
    });
    await completeVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
      providerRequestId: "req_integration",
      actualCostCents: 5,
      outputDurationMilliseconds: 5_000,
      asset: {
        objectKey: `renders/${reservation.render.id}.mp4`,
        contentType: "video/mp4",
        sizeBytes: 4096,
        etag: "etag-integration",
      },
    });

    const result = await cancelVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(result.cancelled).toBe(false);

    const render = await findVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(render?.status).toBe("succeeded");
    const reconciled = await findVideoRenderReservation({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(reconciled?.status).toBe("reconciled");
  }, 30_000);

  it("completes a claimed render and reconciles its reservation", async () => {
    const fixture = await createFixture();
    const reservation = await createVideoRenderReservation(
      reservationInput(fixture),
    );
    await claimVideoRenderRunning({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
      attemptNumber: 1,
      providerRequestId: randomUUID(),
    });
    const completion = await completeVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
      providerRequestId: "req_integration",
      actualCostCents: 5,
      outputDurationMilliseconds: 5_000,
      asset: {
        objectKey: `renders/${reservation.render.id}.mp4`,
        contentType: "video/mp4",
        sizeBytes: 4096,
        etag: "etag-integration",
      },
    });
    expect(completion.completed).toBe(true);
    expect(completion.render.status).toBe("succeeded");

    const reconciled = await findVideoRenderReservation({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(reconciled).toMatchObject({
      status: "reconciled",
      actualCostCents: 5,
    });
  }, 30_000);

  it("records a render failure and releases an unbilled reservation", async () => {
    const fixture = await createFixture();
    const reservation = await createVideoRenderReservation(
      reservationInput(fixture),
    );
    const result = await failVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
      category: "render_failed",
      safeErrorMessage: "The video could not be rendered.",
      providerBilled: false,
    });
    expect(result.failed).toBe(true);

    const render = await findVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(render?.status).toBe("failed");
    expect(render?.safeErrorMessage).toBe("The video could not be rendered.");
    const released = await findVideoRenderReservation({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: reservation.render.id,
    });
    expect(released?.status).toBe("released");
  }, 30_000);

  it("allows re-rendering an identical timeline after a prior render failed", async () => {
    const fixture = await createFixture();
    const requestFingerprint = randomUUID().replaceAll("-", "");

    // First render of this timeline, then it fails.
    const first = await createVideoRenderReservation(
      reservationInput(fixture, {
        requestFingerprint,
        idempotencyKey: `render-idem-${requestFingerprint}-0`,
      }),
    );
    await failVideoRender({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      renderId: first.render.id,
      category: "render_failed",
      safeErrorMessage: "The video could not be rendered.",
      providerBilled: false,
    });

    // The attempt discriminator advances off the count of terminal renders.
    const terminalCount = await countTerminalVideoRendersForTimeline({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      requestFingerprint,
    });
    expect(terminalCount).toBe(1);

    // A retry carries the same timeline fingerprint but an advanced key, so it
    // is a genuinely new render rather than a dedup against the dead one.
    const retry = await createVideoRenderReservation(
      reservationInput(fixture, {
        requestFingerprint,
        idempotencyKey: `render-idem-${requestFingerprint}-${terminalCount}`,
      }),
    );
    expect(retry.created).toBe(true);
    expect(retry.render.id).not.toBe(first.render.id);
    expect(retry.render.status).toBe("pending");

    const rows = await getDatabase()
      .select({ id: videoRenders.id })
      .from(videoRenders)
      .where(eq(videoRenders.requestFingerprint, requestFingerprint));
    expect(rows).toHaveLength(2);
  }, 30_000);

  it("isolates a render from other workspaces", async () => {
    const owner = await createFixture();
    const other = await createFixture();
    const reservation = await createVideoRenderReservation(
      reservationInput(owner),
    );

    const crossWorkspace = await findVideoRender({
      workspaceId: other.workspaceId,
      projectId: owner.projectId,
      renderId: reservation.render.id,
    });
    expect(crossWorkspace).toBeNull();

    const sameWorkspace = await findVideoRender({
      workspaceId: owner.workspaceId,
      projectId: owner.projectId,
      renderId: reservation.render.id,
    });
    expect(sameWorkspace?.id).toBe(reservation.render.id);
  }, 30_000);
});
