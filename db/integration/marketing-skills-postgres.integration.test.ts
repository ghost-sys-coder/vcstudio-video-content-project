import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  saveMarketingSkill,
  softDeleteMarketingSkill,
} from "@/db/commands/marketing-skill-commands";
import { getDatabase } from "@/db/drizzle";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import {
  findMarketingSkill,
  listMarketingSkills,
} from "@/db/repositories/marketing-skills.repository";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;
const workspaceIds = new Set<string>();
const userIds = new Set<string>();

async function createFixture() {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const label = randomUUID();
  workspaceIds.add(workspaceId);
  userIds.add(userId);
  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `skill-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Skill Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Skill Workspace",
      slug: `skill-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
  ]);
  return { workspaceId, userId };
}

function input(slug: string) {
  return {
    slug,
    name: "Founder note",
    description: "Write a concise note for established business owners.",
    instructions: "Teach one practical lesson and close with one next action.",
    baseSkillKey: "write_email" as const,
    inputFields: [
      {
        key: "topic",
        label: "Topic",
        type: "text" as const,
        required: true,
        defaultValue: "A lesson from this week's client work",
      },
    ],
    defaultPlatform: null,
    defaultContentKind: "email" as const,
    isEnabled: true,
  };
}

async function cleanup() {
  if (workspaceIds.size)
    await getDatabase()
      .delete(workspaces)
      .where(inArray(workspaces.id, [...workspaceIds]));
  if (userIds.size)
    await getDatabase()
      .delete(users)
      .where(inArray(users.id, [...userIds]));
}

describeDatabase("marketing skills (postgres)", () => {
  afterAll(cleanup);

  it("creates and reads a skill only inside its workspace", async () => {
    const owner = await createFixture();
    const other = await createFixture();
    const created = await saveMarketingSkill({
      ...owner,
      createdByUserId: owner.userId,
      skill: input("founder-note"),
    });
    expect(
      await findMarketingSkill({
        workspaceId: owner.workspaceId,
        skillId: created.id,
      }),
    ).not.toBeNull();
    expect(
      await findMarketingSkill({
        workspaceId: other.workspaceId,
        skillId: created.id,
      }),
    ).toBeNull();
  }, 30_000);

  it("enforces one active slug per workspace", async () => {
    const fixture = await createFixture();
    await saveMarketingSkill({
      ...fixture,
      createdByUserId: fixture.userId,
      skill: input("duplicate-note"),
    });
    await expect(
      saveMarketingSkill({
        ...fixture,
        createdByUserId: fixture.userId,
        skill: input("duplicate-note"),
      }),
    ).rejects.toThrow();
  }, 30_000);

  it("soft deletion removes the skill from the catalogue and frees its slug", async () => {
    const fixture = await createFixture();
    const created = await saveMarketingSkill({
      ...fixture,
      createdByUserId: fixture.userId,
      skill: input("reusable-note"),
    });
    await softDeleteMarketingSkill({
      workspaceId: fixture.workspaceId,
      skillId: created.id,
    });
    expect(
      await listMarketingSkills({ workspaceId: fixture.workspaceId }),
    ).toEqual([]);
    const replacement = await saveMarketingSkill({
      ...fixture,
      createdByUserId: fixture.userId,
      skill: input("reusable-note"),
    });
    expect(replacement.id).not.toBe(created.id);
  }, 30_000);
});
