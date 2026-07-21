import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  THUMBNAIL_PROMPT_TEMPLATE_SOURCE,
  THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH,
  THUMBNAIL_PROMPT_VERSION,
} from "@studio/prompts";
import {
  cancelThumbnailGeneration,
  completeThumbnailGeneration,
  createThumbnailGenerationReservation,
  dismissThumbnailGeneration,
  failThumbnailGeneration,
  markThumbnailGenerationRunning,
  setThumbnailFavorite,
} from "@/db/commands/thumbnail-generation-commands";
import { listProjectThumbnails } from "@/db/repositories/thumbnail-generation.repository";
import { getDatabase } from "@/db/drizzle";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  projects,
  promptTemplateVersions,
  thumbnailGenerations,
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

async function ensurePromptTemplate(): Promise<string> {
  const database = getDatabase();
  await database
    .insert(promptTemplateVersions)
    .values({
      templateKey: "thumbnail",
      version: THUMBNAIL_PROMPT_VERSION,
      sourceHash: THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH,
      templateSource: THUMBNAIL_PROMPT_TEMPLATE_SOURCE,
    })
    .onConflictDoNothing();
  const [template] = await database
    .select({ id: promptTemplateVersions.id })
    .from(promptTemplateVersions)
    .where(
      and(
        eq(promptTemplateVersions.templateKey, "thumbnail"),
        eq(promptTemplateVersions.version, THUMBNAIL_PROMPT_VERSION),
      ),
    )
    .limit(1);
  if (!template) throw new Error("prompt template missing");
  return template.id;
}

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
      clerkUserId: `thumb-gen-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Thumbnail Gen Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Thumbnail Gen Workspace",
      slug: `thumb-gen-${label}`,
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
      name: "Thumbnail Gen Project",
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

function reservationInput(
  fixture: Fixture,
  promptTemplateVersionId: string,
  estimatedCostCents: number,
  overrides: {
    textMode?: "baked" | "clean";
    headlineText?: string | null;
  } = {},
) {
  const now = new Date();
  return {
    id: randomUUID(),
    reservationId: randomUUID(),
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    userId: fixture.userId,
    platform: "youtube" as const,
    textMode: overrides.textMode ?? ("clean" as const),
    headlineText:
      overrides.headlineText === undefined ? null : overrides.headlineText,
    scriptVersionId: null,
    promptTemplateVersionId,
    promptTemplateVersion: THUMBNAIL_PROMPT_VERSION,
    finalPrompt: "Integration thumbnail prompt.",
    idempotencyKey: `thumb-gen-${randomUUID()}`,
    requestFingerprint: randomUUID().replaceAll("-", ""),
    model: "integration-image-model",
    quality: "medium" as const,
    size: "1536x1024",
    outputFormat: "webp" as const,
    outputCompression: 80,
    background: "opaque",
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

describeDatabase("thumbnail generation ledger (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanup();
  });

  it(
    "reserves, then reconciles with the stored asset and actual cost",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, templateId, 40);
      await createThumbnailGenerationReservation(input);

      const [reserved] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.thumbnailGenerationId, input.id));
      expect(reserved?.status).toBe("pending");
      expect(reserved?.operationType).toBe("thumbnail_generation");
      expect(reserved?.reservedCostCents).toBe(40);

      await markThumbnailGenerationRunning({
        thumbnailGenerationId: input.id,
        attemptCount: 1,
      });
      await completeThumbnailGeneration({
        thumbnailGenerationId: input.id,
        asset: {
          objectKey: `workspaces/${fixture.workspaceId}/projects/${fixture.projectId}/thumbnails/youtube/${input.id}.webp`,
          contentType: "image/webp",
          sizeBytes: 12_345,
          width: 1536,
          height: 1024,
          etag: '"integration-etag"',
        },
        actualCostCents: 33,
        providerRequestId: "req-integration-1",
      });

      const [generation] = await getDatabase()
        .select()
        .from(thumbnailGenerations)
        .where(eq(thumbnailGenerations.id, input.id));
      expect(generation?.status).toBe("succeeded");
      expect(generation?.actualCostCents).toBe(33);
      expect(generation?.assetWidth).toBe(1536);

      const [reconciled] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.thumbnailGenerationId, input.id));
      expect(reconciled?.status).toBe("reconciled");
      expect(reconciled?.actualCostCents).toBe(33);

      await setThumbnailFavorite({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        thumbnailGenerationId: input.id,
        isFavorite: true,
      });
      const [favorited] = await getDatabase()
        .select()
        .from(thumbnailGenerations)
        .where(eq(thumbnailGenerations.id, input.id));
      expect(favorited?.isFavorite).toBe(true);
    },
  );

  it(
    "releases the reservation when the generation fails without provider spend",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, templateId, 40);
      await createThumbnailGenerationReservation(input);
      await failThumbnailGeneration({
        thumbnailGenerationId: input.id,
        category: "provider_error",
        message: "The image provider failed.",
      });

      const [reservation] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.thumbnailGenerationId, input.id));
      expect(reservation?.status).toBe("released");
      expect(reservation?.actualCostCents).toBe(0);
    },
  );

  it(
    "keeps the reservation charged when the provider may have billed the call",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, templateId, 40);
      await createThumbnailGenerationReservation(input);
      await failThumbnailGeneration({
        thumbnailGenerationId: input.id,
        category: "transport_ambiguous",
        message: "The connection ended before completion was confirmed.",
        chargedCostCents: 40,
      });

      const [reservation] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.thumbnailGenerationId, input.id));
      expect(reservation?.status).toBe("reconciled");
      expect(reservation?.actualCostCents).toBe(40);
    },
  );

  it(
    "cancels a queued generation and releases its reservation",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, templateId, 40);
      await createThumbnailGenerationReservation(input);

      const result = await cancelThumbnailGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        thumbnailGenerationId: input.id,
      });
      expect(result.cancelled).toBe(true);

      const [generation] = await getDatabase()
        .select()
        .from(thumbnailGenerations)
        .where(eq(thumbnailGenerations.id, input.id));
      expect(generation?.status).toBe("cancelled");

      const [reservation] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.thumbnailGenerationId, input.id));
      expect(reservation?.status).toBe("released");
      expect(reservation?.actualCostCents).toBe(0);
    },
  );

  it(
    "does not cancel a generation that is already running",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, templateId, 40);
      await createThumbnailGenerationReservation(input);
      await markThumbnailGenerationRunning({
        thumbnailGenerationId: input.id,
        attemptCount: 1,
      });

      const result = await cancelThumbnailGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        thumbnailGenerationId: input.id,
      });
      expect(result.cancelled).toBe(false);

      const [reservation] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.thumbnailGenerationId, input.id));
      expect(reservation?.status).toBe("pending");
    },
  );

  it(
    "enforces the headline/text-mode invariant in the database",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(1_000);
      // A baked thumbnail with no headline must never reach the provider.
      await expect(
        createThumbnailGenerationReservation(
          reservationInput(fixture, templateId, 40, {
            textMode: "baked",
            headlineText: null,
          }),
        ),
      ).rejects.toThrow();
      const rows = await getDatabase()
        .select()
        .from(thumbnailGenerations)
        .where(eq(thumbnailGenerations.projectId, fixture.projectId));
      expect(rows).toHaveLength(0);
    },
  );

  it(
    "dismisses a charged failure without destroying its ledger entry",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, templateId, 40);
      await createThumbnailGenerationReservation(input);
      await failThumbnailGeneration({
        thumbnailGenerationId: input.id,
        category: "transport_ambiguous",
        message: "The connection ended before completion was confirmed.",
        chargedCostCents: 40,
      });

      const dismissal = await dismissThumbnailGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        thumbnailGenerationId: input.id,
      });
      expect(dismissal.dismissed).toBe(true);

      // Hidden from the gallery...
      const visible = await listProjectThumbnails({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        platform: "youtube",
        limit: 20,
      });
      expect(visible.map((row) => row.id)).not.toContain(input.id);

      // ...but the row and its reconciled spend both survive.
      const [generation] = await getDatabase()
        .select()
        .from(thumbnailGenerations)
        .where(eq(thumbnailGenerations.id, input.id));
      expect(generation?.dismissedAt).not.toBeNull();
      const [reservation] = await getDatabase()
        .select()
        .from(usageReservations)
        .where(eq(usageReservations.thumbnailGenerationId, input.id));
      expect(reservation?.status).toBe("reconciled");
      expect(reservation?.actualCostCents).toBe(40);
    },
  );

  it(
    "refuses to dismiss a succeeded thumbnail that has an asset",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(1_000);
      const input = reservationInput(fixture, templateId, 40);
      await createThumbnailGenerationReservation(input);
      await completeThumbnailGeneration({
        thumbnailGenerationId: input.id,
        asset: {
          objectKey: `workspaces/${fixture.workspaceId}/projects/${fixture.projectId}/thumbnails/youtube/${input.id}.webp`,
          contentType: "image/webp",
          sizeBytes: 1_000,
          width: 1536,
          height: 1024,
          etag: '"etag"',
        },
        actualCostCents: 30,
        providerRequestId: null,
      });

      const dismissal = await dismissThumbnailGeneration({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        thumbnailGenerationId: input.id,
      });
      expect(dismissal.dismissed).toBe(false);
      const visible = await listProjectThumbnails({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        platform: "youtube",
        limit: 20,
      });
      expect(visible.map((row) => row.id)).toContain(input.id);
    },
  );

  it("does not dismiss across workspaces", { timeout: 60_000 }, async () => {
    const templateId = await ensurePromptTemplate();
    const owner = await createFixture(1_000);
    const stranger = await createFixture(1_000);
    const input = reservationInput(owner, templateId, 40);
    await createThumbnailGenerationReservation(input);
    await failThumbnailGeneration({
      thumbnailGenerationId: input.id,
      category: "provider_error",
      message: "failed",
    });

    const dismissal = await dismissThumbnailGeneration({
      workspaceId: stranger.workspaceId,
      projectId: stranger.projectId,
      thumbnailGenerationId: input.id,
    });
    expect(dismissal.dismissed).toBe(false);
  });

  it(
    "rejects a reservation that exceeds the project budget",
    { timeout: 60_000 },
    async () => {
      const templateId = await ensurePromptTemplate();
      const fixture = await createFixture(10);
      await expect(
        createThumbnailGenerationReservation(
          reservationInput(fixture, templateId, 50),
        ),
      ).rejects.toBeInstanceOf(BudgetExceededError);
      const rows = await getDatabase()
        .select()
        .from(thumbnailGenerations)
        .where(
          and(
            eq(thumbnailGenerations.workspaceId, fixture.workspaceId),
            eq(thumbnailGenerations.projectId, fixture.projectId),
          ),
        );
      expect(rows).toHaveLength(0);
    },
  );
});
