import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getDatabase } from "@/db/drizzle";
import { transitionMarketingContent } from "@/db/commands/marketing-content-commands";
import { loadMarketingQualityPeriod } from "@/db/repositories/marketing-quality-metrics.repository";
import {
  marketingContentItems,
  marketingContentRevisions,
  marketingGenerationRuns,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;
const fixture = {
  userId: randomUUID(),
  otherUserId: randomUUID(),
  workspaceId: randomUUID(),
  otherWorkspaceId: randomUUID(),
  runId: randomUUID(),
  itemId: randomUUID(),
};

describeDatabase("marketing quality metrics PostgreSQL", () => {
  it("reconciles source rows and rejects cross-workspace revision attribution", async () => {
    const database = getDatabase();
    const createdAt = new Date("2026-08-05T10:00:00Z");
    await database.batch([
      database.insert(users).values([
        {
          id: fixture.userId,
          clerkUserId: `quality-${fixture.userId}`,
          email: `${fixture.userId}@integration.invalid`,
          displayName: "Quality Fixture",
        },
        {
          id: fixture.otherUserId,
          clerkUserId: `quality-${fixture.otherUserId}`,
          email: `${fixture.otherUserId}@integration.invalid`,
          displayName: "Other Fixture",
        },
      ]),
      database.insert(workspaces).values([
        {
          id: fixture.workspaceId,
          name: "Quality",
          slug: `quality-${fixture.workspaceId}`,
          createdByUserId: fixture.userId,
        },
        {
          id: fixture.otherWorkspaceId,
          name: "Other Quality",
          slug: `quality-${fixture.otherWorkspaceId}`,
          createdByUserId: fixture.otherUserId,
        },
      ]),
      database.insert(workspaceMembers).values([
        {
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          role: "owner",
        },
        {
          workspaceId: fixture.otherWorkspaceId,
          userId: fixture.otherUserId,
          role: "owner",
        },
      ]),
      database.insert(marketingGenerationRuns).values({
        id: fixture.runId,
        workspaceId: fixture.workspaceId,
        operation: "content_draft",
        status: "succeeded",
        model: "gpt-test",
        promptVersion: "prompt-v1",
        skillKey: "create_social_post",
        skillVersion: 1,
        brandContextFingerprint: "fixture-context",
        idempotencyKey: `quality:${fixture.runId}`,
        estimatedCostCents: 10,
        actualCostCents: 8,
        completedAt: createdAt,
        createdAt,
      }),
      database.insert(marketingContentItems).values({
        id: fixture.itemId,
        workspaceId: fixture.workspaceId,
        kind: "social_post",
        title: "Fixture",
        bodyPlainText: "A useful post",
        status: "needs_review",
        sourceRunId: fixture.runId,
        createdAt,
      }),
      database.insert(marketingContentRevisions).values({
        workspaceId: fixture.workspaceId,
        contentItemId: fixture.itemId,
        revisionNumber: 1,
        bodyDocument: { type: "doc", content: [] },
        bodyPlainText: "A useful post",
        changeSource: "ai",
        runId: fixture.runId,
        createdAt,
      }),
    ]);
    await transitionMarketingContent({
      workspaceId: fixture.workspaceId,
      contentItemId: fixture.itemId,
      to: "approved",
      reviewedByUserId: fixture.userId,
    });
    const own = await loadMarketingQualityPeriod({
      workspaceId: fixture.workspaceId,
      from: new Date("2026-08-01T00:00:00Z"),
      to: new Date("2026-08-10T00:00:00Z"),
    });
    const other = await loadMarketingQualityPeriod({
      workspaceId: fixture.otherWorkspaceId,
      from: new Date("2026-08-01T00:00:00Z"),
      to: new Date("2026-08-10T00:00:00Z"),
    });
    expect(own.metrics).toMatchObject({
      generated: 1,
      reviewed: 1,
      approved: 1,
      costPerApprovedCents: 8,
    });
    expect(other.metrics.generated).toBe(0);
    await expect(
      database.insert(marketingContentRevisions).values({
        workspaceId: fixture.otherWorkspaceId,
        contentItemId: fixture.itemId,
        revisionNumber: 2,
        bodyDocument: { type: "doc", content: [] },
        bodyPlainText: "Foreign revision",
        changeSource: "human",
        changedByUserId: fixture.otherUserId,
      }),
    ).rejects.toThrow();
  }, 20_000);
});

afterAll(async () => {
  if (!enabled) return;
  const database = getDatabase();
  await database
    .delete(workspaces)
    .where(eq(workspaces.id, fixture.workspaceId));
  await database
    .delete(workspaces)
    .where(eq(workspaces.id, fixture.otherWorkspaceId));
  await database.delete(users).where(eq(users.id, fixture.userId));
  await database.delete(users).where(eq(users.id, fixture.otherUserId));
});
