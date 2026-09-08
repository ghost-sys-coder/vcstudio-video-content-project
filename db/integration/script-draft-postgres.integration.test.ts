import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDatabase } from "@/db/drizzle";
import {
  users,
  workspaces,
  projects,
  projectScriptDrafts,
  projectScriptVersions,
} from "@/db/schema";
import { commitScriptVersion } from "@/db/commands/commit-script-version";
import {
  saveScriptDraft,
  restoreScriptVersion,
} from "@/db/commands/script-commands";
import { findProjectScriptDraft } from "@/db/repositories/projects.repository";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) config({ path: ".env", quiet: true });
const suite = enabled ? describe.sequential : describe.skip;
const workspaceIds: string[] = [];
const userIds: string[] = [];
async function fixture() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Do not run fixtures in production.");
  const workspaceId = randomUUID(),
    userId = randomUUID(),
    projectId = randomUUID();
  workspaceIds.push(workspaceId);
  userIds.push(userId);
  const db = getDatabase();
  await db.batch([
    db.insert(users).values({
      id: userId,
      clerkUserId: `draft-test-${userId}`,
      email: `${userId}@integration.invalid`,
      displayName: "Draft test",
    }),
    db.insert(workspaces).values({
      id: workspaceId,
      name: "Script draft integration",
      slug: `draft-test-${workspaceId}`,
      createdByUserId: userId,
    }),
    db.insert(projects).values({
      id: projectId,
      workspaceId,
      name: "Draft integration",
      status: "draft",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: 0,
      createdByUserId: userId,
    }),
    db.insert(projectScriptDrafts).values({
      projectId,
      workspaceId,
      content: "Original",
      revision: 0,
      updatedByUserId: userId,
    }),
  ]);
  return { workspaceId, userId, projectId };
}
suite("atomic script drafting and approval", () => {
  afterAll(async () => {
    if (workspaceIds.length)
      await getDatabase()
        .delete(workspaces)
        .where(inArray(workspaces.id, workspaceIds));
    if (userIds.length)
      await getDatabase().delete(users).where(inArray(users.id, userIds));
  }, 30_000);
  it("freezes exact text once, swaps approval and refuses stale edits", async () => {
    const scope = await fixture();
    const first = await commitScriptVersion({
      ...scope,
      revision: 0,
      content: "First approved narration",
      approve: true,
    });
    const retry = await commitScriptVersion({
      ...scope,
      revision: 0,
      content: "First approved narration",
      approve: true,
    });
    expect(retry).toEqual(first);
    const next = await commitScriptVersion({
      ...scope,
      revision: first.revision,
      content: "Final approved narration",
      approve: true,
    });
    expect(next.revision).toBe(2);
    const versions = await getDatabase()
      .select()
      .from(projectScriptVersions)
      .where(eq(projectScriptVersions.projectId, scope.projectId));
    expect(versions).toHaveLength(2);
    expect(
      versions
        .filter((version) => version.status === "approved")
        .map((version) => version.content),
    ).toEqual(["Final approved narration"]);
    await expect(
      saveScriptDraft({ ...scope, revision: 0, content: "Stale" }),
    ).rejects.toThrow("SCRIPT_REVISION_CONFLICT");
    expect((await findProjectScriptDraft(scope))?.content).toBe(
      "Final approved narration",
    );
  }, 30_000);
  it("allows one concurrent writer and leaves no partial snapshot", async () => {
    const scope = await fixture();
    const results = await Promise.allSettled(
      ["One", "Two"].map((content) =>
        commitScriptVersion({ ...scope, revision: 0, content, approve: true }),
      ),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const versions = await getDatabase()
      .select()
      .from(projectScriptVersions)
      .where(eq(projectScriptVersions.projectId, scope.projectId));
    expect(versions).toHaveLength(1);
    expect((await findProjectScriptDraft(scope))?.content).toBe(
      versions[0]?.content,
    );
  }, 30_000);
  it("scopes claims to the workspace and makes restoration atomic", async () => {
    const scope = await fixture();
    const other = await fixture();
    await expect(
      commitScriptVersion({
        ...scope,
        workspaceId: other.workspaceId,
        revision: 0,
        content: "Unauthorized",
        approve: true,
      }),
    ).rejects.toThrow("SCRIPT_REVISION_CONFLICT");
    const original = await commitScriptVersion({
      ...scope,
      revision: 0,
      content: "Original version",
      approve: false,
    });
    await saveScriptDraft({ ...scope, revision: 1, content: "New draft" });
    await expect(
      restoreScriptVersion({ ...scope, revision: 1, versionId: original.id }),
    ).rejects.toThrow("SCRIPT_REVISION_CONFLICT");
    const restored = await restoreScriptVersion({
      ...scope,
      revision: 2,
      versionId: original.id,
    });
    expect(restored.revision).toBe(3);
    expect((await findProjectScriptDraft(scope))?.content).toBe(
      "Original version",
    );
    const versions = await getDatabase()
      .select()
      .from(projectScriptVersions)
      .where(eq(projectScriptVersions.projectId, scope.projectId));
    expect(versions).toHaveLength(2);
  }, 30_000);
});
