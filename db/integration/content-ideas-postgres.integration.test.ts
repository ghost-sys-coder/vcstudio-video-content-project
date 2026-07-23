import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  archiveContentIdea,
  recordFailedIdeaGenerationRun,
  recordIdeaGenerationRun,
  saveContentIdea,
} from "@/db/commands/idea-commands";
import {
  findContentIdea,
  listContentIdeas,
} from "@/db/repositories/content-ideas.repository";
import { getDatabase } from "@/db/drizzle";
import { users, workspaceMembers, workspaces } from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

type Fixture = { userId: string; workspaceId: string };
const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

async function createFixture(): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const label = randomUUID();
  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);
  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `idea-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Idea Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Idea Workspace",
      slug: `idea-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
  ]);
  return { userId, workspaceId };
}

function ideaInput(fixture: Fixture, overrides: Partial<{ niche: string }>) {
  return {
    workspaceId: fixture.workspaceId,
    userId: fixture.userId,
    generationRunId: null,
    niche: overrides.niche ?? "personal finance",
    topic: "Why your budget keeps failing",
    targetAudience: "Broke college students",
    tone: "Encouraging, plainspoken",
    targetDurationSeconds: 45,
    primaryPlatform: "tiktok" as const,
    hookAngle: "You are not bad with money — your method is",
    rationale: "Reframes shame into a fixable system.",
    hookType: "reframe",
    source: "ai" as const,
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

describeDatabase("content ideas (postgres)", () => {
  afterAll(async () => {
    await cleanup();
  });

  it("saves an idea and lists it back for its workspace", async () => {
    const fixture = await createFixture();
    const saved = await saveContentIdea(ideaInput(fixture, {}));
    expect(saved.id).toBeTruthy();
    expect(saved.source).toBe("ai");

    const ideas = await listContentIdeas({ workspaceId: fixture.workspaceId });
    expect(ideas.map((idea) => idea.id)).toContain(saved.id);
  });

  it("excludes archived ideas unless explicitly included", async () => {
    const fixture = await createFixture();
    const saved = await saveContentIdea(ideaInput(fixture, {}));

    const archived = await archiveContentIdea({
      workspaceId: fixture.workspaceId,
      ideaId: saved.id,
    });
    expect(archived.updated).toBe(true);

    const active = await listContentIdeas({ workspaceId: fixture.workspaceId });
    expect(active.map((idea) => idea.id)).not.toContain(saved.id);

    const all = await listContentIdeas({
      workspaceId: fixture.workspaceId,
      includeArchived: true,
    });
    expect(all.map((idea) => idea.id)).toContain(saved.id);
  });

  it("isolates ideas across workspaces", async () => {
    const owner = await createFixture();
    const intruder = await createFixture();
    const saved = await saveContentIdea(ideaInput(owner, {}));

    // A foreign workspace cannot read the idea.
    expect(
      await findContentIdea({
        workspaceId: intruder.workspaceId,
        ideaId: saved.id,
      }),
    ).toBeNull();
    // And cannot archive it.
    const archived = await archiveContentIdea({
      workspaceId: intruder.workspaceId,
      ideaId: saved.id,
    });
    expect(archived.updated).toBe(false);
    // The owning workspace still can.
    expect(
      await findContentIdea({
        workspaceId: owner.workspaceId,
        ideaId: saved.id,
      }),
    ).not.toBeNull();
  });

  it("records completed and failed generation runs", async () => {
    const fixture = await createFixture();
    const completed = await recordIdeaGenerationRun({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      niche: "home cooking",
      platform: "youtube",
      tonePreference: "warm",
      language: "English",
      requestedCount: 5,
      resultCount: 5,
      model: "integration-text-model",
      promptVersion: "idea-generation-v1",
      finalPrompt: "Integration idea prompt.",
      inputTokens: 800,
      outputTokens: 600,
      actualCostCents: 1,
      providerRequestId: randomUUID(),
    });
    expect(completed.id).toBeTruthy();

    const failed = await recordFailedIdeaGenerationRun({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      niche: "home cooking",
      platform: null,
      tonePreference: null,
      language: "English",
      requestedCount: 5,
      model: "integration-text-model",
      promptVersion: "idea-generation-v1",
      finalPrompt: "Integration idea prompt.",
      category: "provider_error",
      message: "The idea generator was unavailable. Please try again.",
    });
    expect(failed.id).toBeTruthy();
    expect(failed.id).not.toBe(completed.id);
  });
});
