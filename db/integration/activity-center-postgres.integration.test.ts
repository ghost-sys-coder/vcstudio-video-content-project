import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { getDatabase } from "@/db/drizzle";
import {
  acknowledgeWorkspaceActivity,
  listWorkspaceActivity,
} from "@/db/repositories/activity.repository";
import {
  marketingContentItems,
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
  contentId: randomUUID(),
};

describeDatabase("activity center PostgreSQL", () => {
  it("isolates workspaces and acknowledges without changing workflow state", async () => {
    const database = getDatabase();
    await database.batch([
      database.insert(users).values([
        {
          id: fixture.userId,
          clerkUserId: `activity-${fixture.userId}`,
          email: `${fixture.userId}@integration.invalid`,
          displayName: "Activity Fixture",
        },
        {
          id: fixture.otherUserId,
          clerkUserId: `activity-${fixture.otherUserId}`,
          email: `${fixture.otherUserId}@integration.invalid`,
          displayName: "Other Fixture",
        },
      ]),
      database.insert(workspaces).values([
        {
          id: fixture.workspaceId,
          name: "Activity",
          slug: `activity-${fixture.workspaceId}`,
          createdByUserId: fixture.userId,
        },
        {
          id: fixture.otherWorkspaceId,
          name: "Other",
          slug: `activity-${fixture.otherWorkspaceId}`,
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
      database
        .insert(marketingContentItems)
        .values({
          id: fixture.contentId,
          workspaceId: fixture.workspaceId,
          kind: "social_post",
          title: "Review me",
          status: "needs_review",
          createdByUserId: fixture.userId,
        }),
    ]);
    const own = await listWorkspaceActivity({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      state: "all",
      page: 1,
    });
    const other = await listWorkspaceActivity({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId,
      state: "all",
      page: 1,
    });
    expect(
      own.items.some(
        (item) => item.key === `marketing-content:${fixture.contentId}`,
      ),
    ).toBe(true);
    expect(
      other.items.some(
        (item) => item.key === `marketing-content:${fixture.contentId}`,
      ),
    ).toBe(false);
    expect(
      await acknowledgeWorkspaceActivity({
        workspaceId: fixture.otherWorkspaceId,
        userId: fixture.otherUserId,
        activityKey: `marketing-content:${fixture.contentId}`,
      }),
    ).toBe(false);
    expect(
      await acknowledgeWorkspaceActivity({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        activityKey: `marketing-content:${fixture.contentId}`,
      }),
    ).toBe(true);
    const [source] = await database
      .select({ status: marketingContentItems.status })
      .from(marketingContentItems)
      .where(eq(marketingContentItems.id, fixture.contentId));
    expect(source?.status).toBe("needs_review");
  });
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
