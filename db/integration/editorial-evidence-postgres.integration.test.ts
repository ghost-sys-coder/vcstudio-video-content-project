import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { getDatabase } from "@/db/drizzle";
import {
  projects,
  projectScriptDrafts,
  projectSources,
  scriptClaims,
  scriptClaimSources,
  scriptVersionEvidence,
  users,
  workspaces,
} from "@/db/schema";
import { commitScriptVersion } from "@/db/commands/commit-script-version";
import {
  archiveProjectSource,
  citeSourceForClaim,
  createProjectSource,
  createScriptClaim,
  recordEditorialSignoff,
  reviewScriptClaim,
} from "@/db/commands/editorial-evidence-commands";
import { findScriptVersionEvidence } from "@/db/repositories/editorial-evidence.repository";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) config({ path: ".env", quiet: true });
const suite = enabled ? describe.sequential : describe.skip;
const workspaceIds: string[] = [];
const userIds: string[] = [];

async function fixture() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Do not run fixtures in production.");
  const workspaceId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  workspaceIds.push(workspaceId);
  userIds.push(userId);
  const db = getDatabase();
  await db.batch([
    db.insert(users).values({
      id: userId,
      clerkUserId: `evidence-test-${userId}`,
      email: `${userId}@integration.invalid`,
      displayName: "Evidence test",
    }),
    db.insert(workspaces).values({
      id: workspaceId,
      name: "Editorial evidence integration",
      slug: `evidence-test-${workspaceId}`,
      createdByUserId: userId,
    }),
    db.insert(projects).values({
      id: projectId,
      workspaceId,
      name: "Evidence integration",
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
      content: "The fund returned 8% last year.",
      revision: 0,
      updatedByUserId: userId,
    }),
  ]);
  return { workspaceId, userId, projectId };
}

suite("source-backed editorial review against PostgreSQL", () => {
  afterAll(async () => {
    if (workspaceIds.length)
      await getDatabase()
        .delete(workspaces)
        .where(inArray(workspaces.id, workspaceIds));
    if (userIds.length)
      await getDatabase().delete(users).where(inArray(users.id, userIds));
  }, 30_000);

  it("freezes the review onto the approved version in the same statement", async () => {
    const scope = await fixture();
    const source = await createProjectSource({
      ...scope,
      userId: scope.userId,
      kind: "link",
      title: "Fund annual report",
      url: "https://example.org/report",
      host: "example.org",
      notes: "Table 3 gives the annual return.",
    });
    const claim = await createScriptClaim({
      ...scope,
      userId: scope.userId,
      quotedText: "The fund returned 8% last year.",
    });
    await reviewScriptClaim({
      ...scope,
      claimId: claim.id,
      userId: scope.userId,
      reviewState: "supported",
      reviewNote: "Matches table 3.",
    });
    await citeSourceForClaim({
      ...scope,
      claimId: claim.id,
      sourceId: source.id,
      userId: scope.userId,
      stance: "supports",
      excerpt: "Annual return: 8.0%",
    });
    await recordEditorialSignoff({
      ...scope,
      userId: scope.userId,
      scriptFingerprint: "The fund returned 8% last year.",
      coveredClaims: [{ id: claim.id, reviewState: "supported" }],
      note: "",
    });

    const version = await commitScriptVersion({
      ...scope,
      userId: scope.userId,
      revision: 0,
      content: "The fund returned 8% last year.",
      approve: true,
    });
    const frozen = await findScriptVersionEvidence({
      workspaceId: scope.workspaceId,
      scriptVersionId: version.id,
    });
    expect(frozen).not.toBeNull();
    expect(frozen?.claimCount).toBe(1);
    expect(frozen?.supportedCount).toBe(1);
    expect(frozen?.signedOffByUserId).toBe(scope.userId);
    const claims = frozen?.evidence.claims ?? [];
    expect(claims[0]?.quotedText).toBe("The fund returned 8% last year.");
    expect(claims[0]?.citations[0]).toMatchObject({
      title: "Fund annual report",
      host: "example.org",
      stance: "supports",
    });
  }, 30_000);

  it("keeps the frozen record readable after the live source changes", async () => {
    // Reproducibility is the whole point: a citation that followed a foreign
    // key would quietly restate what the approval was based on.
    const scope = await fixture();
    const source = await createProjectSource({
      ...scope,
      userId: scope.userId,
      kind: "link",
      title: "Original title",
      url: "https://example.org/a",
      host: "example.org",
      notes: "",
    });
    const claim = await createScriptClaim({
      ...scope,
      userId: scope.userId,
      quotedText: "The fund returned 8% last year.",
    });
    await citeSourceForClaim({
      ...scope,
      claimId: claim.id,
      sourceId: source.id,
      userId: scope.userId,
      stance: "supports",
      excerpt: "",
    });
    const version = await commitScriptVersion({
      ...scope,
      userId: scope.userId,
      revision: 0,
      content: "The fund returned 8% last year.",
      approve: true,
    });

    await getDatabase()
      .update(projectSources)
      .set({ title: "Renamed afterwards" })
      .where(eq(projectSources.id, source.id));
    await getDatabase()
      .delete(scriptClaims)
      .where(eq(scriptClaims.id, claim.id));

    const frozen = await findScriptVersionEvidence({
      workspaceId: scope.workspaceId,
      scriptVersionId: version.id,
    });
    expect(frozen?.evidence.claims[0]?.citations[0]?.title).toBe(
      "Original title",
    );
  }, 30_000);

  it("records an empty review rather than no record at all", async () => {
    const scope = await fixture();
    const version = await commitScriptVersion({
      ...scope,
      userId: scope.userId,
      revision: 0,
      content: "Nothing was reviewed here.",
      approve: true,
    });
    const frozen = await findScriptVersionEvidence({
      workspaceId: scope.workspaceId,
      scriptVersionId: version.id,
    });
    expect(frozen?.claimCount).toBe(0);
    expect(frozen?.evidence.claims).toEqual([]);
    expect(frozen?.signedOffByUserId).toBeNull();
  });

  it("writes no evidence row for a save that does not approve", async () => {
    const scope = await fixture();
    const version = await commitScriptVersion({
      ...scope,
      userId: scope.userId,
      revision: 0,
      content: "Still a draft.",
      approve: false,
    });
    expect(
      await findScriptVersionEvidence({
        workspaceId: scope.workspaceId,
        scriptVersionId: version.id,
      }),
    ).toBeNull();
  });

  it("refuses to delete a source that a citation depends on", async () => {
    const scope = await fixture();
    const source = await createProjectSource({
      ...scope,
      userId: scope.userId,
      kind: "note",
      title: "A note",
      url: null,
      host: null,
      notes: "",
    });
    const claim = await createScriptClaim({
      ...scope,
      userId: scope.userId,
      quotedText: "The fund returned 8% last year.",
    });
    await citeSourceForClaim({
      ...scope,
      claimId: claim.id,
      sourceId: source.id,
      userId: scope.userId,
      stance: "disputes",
      excerpt: "",
    });
    await expect(
      getDatabase()
        .delete(projectSources)
        .where(eq(projectSources.id, source.id)),
    ).rejects.toThrow();
    expect(await archiveProjectSource({ ...scope, sourceId: source.id })).toBe(
      true,
    );
  }, 30_000);

  it("refuses a verdict with no reviewer, at the database level", async () => {
    const scope = await fixture();
    const claim = await createScriptClaim({
      ...scope,
      userId: scope.userId,
      quotedText: "The fund returned 8% last year.",
    });
    await expect(
      getDatabase()
        .update(scriptClaims)
        .set({ reviewState: "supported", reviewedByUserId: null })
        .where(eq(scriptClaims.id, claim.id)),
    ).rejects.toThrow();
  });

  it("refuses to cite another workspace's source", async () => {
    const first = await fixture();
    const second = await fixture();
    const foreign = await createProjectSource({
      ...second,
      userId: second.userId,
      kind: "note",
      title: "Other workspace note",
      url: null,
      host: null,
      notes: "",
    });
    const claim = await createScriptClaim({
      ...first,
      userId: first.userId,
      quotedText: "The fund returned 8% last year.",
    });
    const cited = await citeSourceForClaim({
      ...first,
      claimId: claim.id,
      sourceId: foreign.id,
      userId: first.userId,
      stance: "supports",
      excerpt: "",
    });
    expect(cited).toBe(false);
    const rows = await getDatabase()
      .select()
      .from(scriptClaimSources)
      .where(
        and(
          eq(scriptClaimSources.workspaceId, first.workspaceId),
          eq(scriptClaimSources.claimId, claim.id),
        ),
      );
    expect(rows).toHaveLength(0);
  }, 30_000);

  it("keeps one citation per source per claim, updating the stance", async () => {
    const scope = await fixture();
    const source = await createProjectSource({
      ...scope,
      userId: scope.userId,
      kind: "note",
      title: "A note",
      url: null,
      host: null,
      notes: "",
    });
    const claim = await createScriptClaim({
      ...scope,
      userId: scope.userId,
      quotedText: "The fund returned 8% last year.",
    });
    const base = {
      ...scope,
      claimId: claim.id,
      sourceId: source.id,
      userId: scope.userId,
      excerpt: "",
    };
    await citeSourceForClaim({ ...base, stance: "supports" });
    await citeSourceForClaim({ ...base, stance: "disputes" });
    const rows = await getDatabase()
      .select()
      .from(scriptClaimSources)
      .where(eq(scriptClaimSources.claimId, claim.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.stance).toBe("disputes");
  }, 30_000);

  it("removes the whole review when its project is deleted", async () => {
    const scope = await fixture();
    const claim = await createScriptClaim({
      ...scope,
      userId: scope.userId,
      quotedText: "The fund returned 8% last year.",
    });
    await commitScriptVersion({
      ...scope,
      userId: scope.userId,
      revision: 0,
      content: "The fund returned 8% last year.",
      approve: true,
    });
    await getDatabase()
      .delete(projects)
      .where(eq(projects.id, scope.projectId));
    expect(
      await getDatabase()
        .select()
        .from(scriptClaims)
        .where(eq(scriptClaims.id, claim.id)),
    ).toHaveLength(0);
    expect(
      await getDatabase()
        .select()
        .from(scriptVersionEvidence)
        .where(eq(scriptVersionEvidence.projectId, scope.projectId)),
    ).toHaveLength(0);
  }, 30_000);
});
