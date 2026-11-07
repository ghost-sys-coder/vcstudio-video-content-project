import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/pglite";
vi.mock("server-only", () => ({}));
const shared = vi.hoisted(() => ({ database: undefined as unknown }));
vi.mock("@/db/drizzle", () => ({ getDatabase: () => shared.database }));
import {
  ensureMcpConnection,
  saveMcpGrant,
  beginMcpOperation,
  consumeMcpApproval,
  consumeMcpAutonomousPublication,
  findMcpConnection,
  findMcpGrant,
  revokeMcpConnection,
  findMcpOperation,
} from "@/db/repositories/mcp.repository";
import { lockMcpPost } from "@/db/commands/mcp-post-lock";
import { updateSocialPostDraft } from "@/db/commands/social-post-commands";
import { saveProjectBrief } from "@/db/commands/project-brief.command";
import { scheduleSocialPost } from "@/db/commands/social-post-schedule-commands";
import { beginMcpPublicationWithDestinations } from "@/db/commands/mcp-publication-destinations";
import { listSocialPostDraftConnectionIds } from "@/db/repositories/social-post-destinations.repository";
import { mcpIds } from "@/lib/test-utils/mcp-fixtures";
const pg = new PGlite();
let connectionId: string;
beforeAll(async () => {
  await pg.exec(`
    create table users (id uuid primary key);
    create type audit_action as enum ('workspace_created');
    create table workspaces (id uuid primary key);
    create table workspace_members (workspace_id uuid, user_id uuid, role text);
    create table project_briefs (id uuid primary key default gen_random_uuid(), workspace_id uuid not null, project_id uuid unique, topic text, target_audience text, tone text, target_duration_seconds integer, primary_platform text, hook_angle text, niche text, updated_by_user_id uuid, created_at timestamptz default now(), updated_at timestamptz);
    create table media_assets (id uuid primary key, workspace_id uuid not null, unique(id, workspace_id));
    create table scene_image_generations (id uuid primary key, workspace_id uuid not null, unique(id, workspace_id));
    create table social_posts (id uuid primary key, workspace_id uuid not null, name text not null default '', body_document jsonb not null default '{"type":"doc","content":[]}', body_plain_text text not null default '', status text not null default 'draft', version integer not null default 1, scheduled_at timestamptz, scheduled_timezone text not null default 'UTC', project_id uuid, created_by_user_id uuid, created_at timestamptz default now(), updated_at timestamptz default now(), unique(id, workspace_id));
    create table platform_connections (id uuid primary key, workspace_id uuid not null, unique(id, workspace_id));
    create table social_post_media (id uuid primary key default gen_random_uuid(), post_id uuid not null references social_posts(id), workspace_id uuid not null, media_asset_id uuid references media_assets(id), render_id uuid, position integer not null, unique(post_id,position));
    create type content_platform as enum ('linkedin');
    create table social_post_targets (id uuid primary key default gen_random_uuid(), post_id uuid not null references social_posts(id), workspace_id uuid not null, platform content_platform, connection_id uuid, override_body_plain_text text, idempotency_key text, status text default 'pending', unique(post_id,connection_id));
    insert into users values ('${mcpIds.user}');
    insert into workspaces values ('${mcpIds.workspace}'), ('88888888-8888-4888-8888-888888888888');
    insert into workspace_members values ('${mcpIds.workspace}', '${mcpIds.user}', 'owner');
    insert into social_posts (id,workspace_id) values ('${mcpIds.post}','${mcpIds.workspace}');
    insert into media_assets values ('${mcpIds.asset}','${mcpIds.workspace}');
    insert into platform_connections values ('${mcpIds.destination}','${mcpIds.workspace}');
  `);
  await pg.exec(
    await readFile(
      "migrations/20261103225447_mcp_import_reuse_publish/migration.sql",
      "utf8",
    ),
  );
  const db = drizzle({ client: pg });
  await pg.exec(
    await readFile(
      "migrations/20261103225718_mcp_audit_events/migration.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      "migrations/20261103233638_mcp_project_provenance_cleanup/migration.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      "migrations/20261104104742_social_post_draft_destinations/migration.sql",
      "utf8",
    ),
  );
  await pg.exec(`
    alter table social_posts add column youtube_settings jsonb, add column youtube_thumbnail_asset_id uuid;
    alter table social_post_targets add column youtube_settings jsonb, add column youtube_thumbnail_asset_id uuid, add column youtube_thumbnail_status text, add column youtube_thumbnail_error text;
  `);
  await pg.exec(
    await readFile(
      "migrations/20261107223040_mcp_autonomous_publishing/migration.sql",
      "utf8",
    ),
  );
  shared.database = Object.assign(db, {
    batch: (queries: { toSQL(): { sql: string; params: unknown[] } }[]) =>
      pg.transaction(async (tx) => {
        const results = [];
        for (const query of queries) {
          const sql = query.toSQL();
          results.push((await tx.query(sql.sql, sql.params)).rows);
        }
        return results;
      }),
  });
  connectionId = (await ensureMcpConnection(mcpIds.user, "test-client")).id;
  await saveMcpGrant({
    connectionId,
    userId: mcpIds.user,
    workspaceId: mcpIds.workspace,
    scopes: ["vcstudio:read", "vcstudio:edit", "vcstudio:publish"],
    publicationApprovalMode: "manual",
  });
}, 30000);
afterAll(async () => {
  await pg.close();
});
async function autonomousRecord() {
  await pg.query(
    "update workspace_members set role='owner' where workspace_id=$1 and user_id=$2",
    [mcpIds.workspace, mcpIds.user],
  );
  const initial = await ensureMcpConnection(mcpIds.user, randomUUID());
  await saveMcpGrant({
    connectionId: initial.id,
    workspaceId: mcpIds.workspace,
    userId: mcpIds.user,
    scopes: ["vcstudio:read", "vcstudio:publish"],
    publicationApprovalMode: "autonomous",
  });
  const connection = await findMcpConnection(initial.id, mcpIds.user);
  const grant = await findMcpGrant(initial.id, mcpIds.workspace);
  if (!connection || !grant)
    throw new Error("Missing isolated autonomy fixture");
  const { operation } = await beginMcpOperation({
    ...operationInput(randomUUID()),
    connectionId: initial.id,
    status: "prepared",
    approvalHash: null,
    input: { approvalMode: "autonomous" },
  });
  return {
    operation,
    connection,
    claim: {
      operationId: operation.id,
      workspaceId: mcpIds.workspace,
      connectionId: initial.id,
      userId: mcpIds.user,
      connectionUpdatedAt: connection.updatedAt,
      grantUpdatedAt: grant.updatedAt,
    },
  };
}
describe("autonomous publication SQL authorization", () => {
  it("keeps the generated migration default manual for existing connections", async () => {
    const rows = await pg.query<{ publication_approval_mode: string }>(
      "select publication_approval_mode from mcp_workspace_grants where connection_id=$1",
      [connectionId],
    );
    expect(rows.rows[0].publication_approval_mode).toBe("manual");
  });
  it("atomically consumes a prepared operation only once", async () => {
    const { claim } = await autonomousRecord();
    const results = await Promise.all([
      consumeMcpAutonomousPublication(claim),
      consumeMcpAutonomousPublication(claim),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)?.status).toBe("approved");
  });
  it("rejects a different user or workspace", async () => {
    const { claim } = await autonomousRecord();
    expect(
      await consumeMcpAutonomousPublication({ ...claim, userId: randomUUID() }),
    ).toBeNull();
    expect(
      await consumeMcpAutonomousPublication({
        ...claim,
        workspaceId: "88888888-8888-4888-8888-888888888888",
      }),
    ).toBeNull();
  });
  it("rechecks owner membership at consumption", async () => {
    const { claim } = await autonomousRecord();
    await pg.query(
      "update workspace_members set role='editor' where workspace_id=$1 and user_id=$2",
      [mcpIds.workspace, mcpIds.user],
    );
    expect(await consumeMcpAutonomousPublication(claim)).toBeNull();
  });
  it("invalidates a pending execution when the grant changes", async () => {
    const { claim } = await autonomousRecord();
    await saveMcpGrant({
      connectionId: claim.connectionId,
      userId: mcpIds.user,
      workspaceId: mcpIds.workspace,
      scopes: ["vcstudio:read", "vcstudio:publish"],
      publicationApprovalMode: "manual",
    });
    expect(await consumeMcpAutonomousPublication(claim)).toBeNull();
  });
  it("rejects expired preparations", async () => {
    const { claim } = await autonomousRecord();
    await pg.query(
      "update mcp_operations set expires_at=now()-interval '1 minute' where id=$1",
      [claim.operationId],
    );
    expect(await consumeMcpAutonomousPublication(claim)).toBeNull();
  });
  it("cancels prepared work on revocation while preserving authorized outbox work", async () => {
    const pending = await autonomousRecord();
    await revokeMcpConnection(pending.connection.id, mcpIds.user);
    expect(await consumeMcpAutonomousPublication(pending.claim)).toBeNull();
    expect(
      (
        await findMcpOperation({
          workspaceId: mcpIds.workspace,
          operationId: pending.operation.id,
        })
      )?.status,
    ).toBe("cancelled");
    const approved = await autonomousRecord();
    await consumeMcpAutonomousPublication(approved.claim);
    await revokeMcpConnection(approved.connection.id, mcpIds.user);
    expect(
      (
        await findMcpOperation({
          workspaceId: mcpIds.workspace,
          operationId: approved.operation.id,
        })
      )?.status,
    ).toBe("approved");
  });
  it("enforces autonomous Publish scope in PostgreSQL", async () => {
    const { connection } = await autonomousRecord();
    await expect(
      pg.query(
        "update mcp_workspace_grants set scopes='[\"vcstudio:read\"]'::jsonb where connection_id=$1",
        [connection.id],
      ),
    ).rejects.toThrow();
  });
});
function operationInput(
  key: string,
  status: "requires_approval" | "queued" | "approved" = "requires_approval",
) {
  return {
    workspaceId: mcpIds.workspace,
    connectionId,
    userId: mcpIds.user,
    kind: "publish_post",
    idempotencyKey: key,
    fingerprint: "fingerprint",
    status,
    input: {},
    approvalHash: "proof-hash",
    expiresAt: new Date(Date.now() + 60000),
  };
}
describe("MCP SQL and migration behavior", () => {
  it("retains attachments and destination selections over repeated draft saves", async () => {
    const postId = randomUUID();
    await pg.query("insert into social_posts(id,workspace_id) values ($1,$2)", [
      postId,
      mcpIds.workspace,
    ]);
    const base = {
      workspaceId: mcpIds.workspace,
      postId,
      name: "Attachment save",
      bodyPlainText: "Draft",
      bodyDocument: { type: "doc" as const, content: [] },
      connectionIds: [mcpIds.destination],
    };
    expect(
      (
        await updateSocialPostDraft({
          ...base,
          expectedVersion: 1,
          attachments: [],
        })
      ).outcome,
    ).toBe("updated");
    expect(
      (
        await updateSocialPostDraft({
          ...base,
          expectedVersion: 2,
          attachments: [{ source: "library" as const, id: mcpIds.asset }],
        })
      ).outcome,
    ).toBe("updated");
    expect(
      (
        await updateSocialPostDraft({
          ...base,
          expectedVersion: 3,
          attachments: [{ source: "library" as const, id: mcpIds.asset }],
        })
      ).outcome,
    ).toBe("updated");
    expect(
      (
        await pg.query(
          "select media_asset_id from social_post_media where post_id=$1",
          [postId],
        )
      ).rows,
    ).toEqual([{ media_asset_id: mcpIds.asset }]);
    expect(
      await listSocialPostDraftConnectionIds({
        workspaceId: mcpIds.workspace,
        postId,
      }),
    ).toEqual([mcpIds.destination]);
  });
  it("restores, preserves and clears selected draft accounts with revision protection and no dispatch targets", async () => {
    const postId = randomUUID();
    await pg.query("insert into social_posts(id,workspace_id) values ($1,$2)", [
      postId,
      mcpIds.workspace,
    ]);
    const input = {
      workspaceId: mcpIds.workspace,
      postId,
      expectedVersion: 1,
      name: "Saved accounts",
      bodyPlainText: "Draft",
      bodyDocument: { type: "doc" as const, content: [] },
      attachments: [],
      connectionIds: [mcpIds.destination],
    };
    expect((await updateSocialPostDraft(input)).outcome).toBe("updated");
    expect(await listSocialPostDraftConnectionIds(input)).toEqual([
      mcpIds.destination,
    ]);
    expect(
      (
        await updateSocialPostDraft({
          ...input,
          expectedVersion: 2,
          connectionIds: undefined,
        })
      ).outcome,
    ).toBe("updated");
    expect(await listSocialPostDraftConnectionIds(input)).toEqual([
      mcpIds.destination,
    ]);
    expect(
      (
        await updateSocialPostDraft({
          ...input,
          expectedVersion: 3,
          connectionIds: [],
        })
      ).outcome,
    ).toBe("updated");
    expect(await listSocialPostDraftConnectionIds(input)).toEqual([]);
    expect(
      (await updateSocialPostDraft({ ...input, expectedVersion: 3 })).outcome,
    ).toBe("conflict");
    expect(await listSocialPostDraftConnectionIds(input)).toEqual([]);
    expect(
      (
        await pg.query("select * from social_post_targets where post_id=$1", [
          postId,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("rolls back the whole draft save for a cross-workspace destination", async () => {
    const postId = randomUUID(),
      foreignId = randomUUID();
    await pg.query("insert into social_posts(id,workspace_id) values ($1,$2)", [
      postId,
      mcpIds.workspace,
    ]);
    await pg.query("insert into platform_connections values ($1,$2)", [
      foreignId,
      "88888888-8888-4888-8888-888888888888",
    ]);
    const input = {
      workspaceId: mcpIds.workspace,
      postId,
      expectedVersion: 1,
      name: "Original",
      bodyPlainText: "Original",
      bodyDocument: { type: "doc" as const, content: [] },
      attachments: [],
      connectionIds: [mcpIds.destination],
    };
    await updateSocialPostDraft(input);
    await expect(
      updateSocialPostDraft({
        ...input,
        expectedVersion: 2,
        name: "Must roll back",
        connectionIds: [foreignId],
      }),
    ).rejects.toThrow();
    expect(
      (
        await pg.query("select name,version from social_posts where id=$1", [
          postId,
        ])
      ).rows[0],
    ).toEqual({ name: "Original", version: 2 });
    expect(await listSocialPostDraftConnectionIds(input)).toEqual([
      mcpIds.destination,
    ]);
    expect(
      await listSocialPostDraftConnectionIds({
        ...input,
        workspaceId: "88888888-8888-4888-8888-888888888888",
      }),
    ).toEqual([]);
  });
  it("commits MCP destination intent, its revision and approval operation atomically without scheduling", async () => {
    const postId = randomUUID(),
      secondPostId = randomUUID();
    await pg.query(
      "insert into social_posts(id,workspace_id) values ($1,$3),($2,$3)",
      [postId, secondPostId, mcpIds.workspace],
    );
    const input = {
      ...operationInput(`destination-preview-${postId}`),
      postId,
      expectedVersion: 1,
      connectionIds: [mcpIds.destination],
      input: {
        request: { postId, expectedVersion: 2 },
        preview: { version: 2 },
      },
    };
    const result = await beginMcpPublicationWithDestinations(input);
    expect(result?.operation.status).toBe("requires_approval");
    expect(result?.operation.input.request).toEqual({
      postId,
      expectedVersion: 2,
    });
    expect(await listSocialPostDraftConnectionIds(input)).toEqual([
      mcpIds.destination,
    ]);
    expect(
      (
        await pg.query(
          "select version,status,scheduled_at from social_posts where id=$1",
          [postId],
        )
      ).rows[0],
    ).toEqual({ version: 2, status: "draft", scheduled_at: null });
    expect(
      await beginMcpPublicationWithDestinations({
        ...input,
        idempotencyKey: "stale-destination-preview",
      }),
    ).toBeNull();
    // Reusing a request key for another post must roll back its intent/revision.
    await expect(
      beginMcpPublicationWithDestinations({ ...input, postId: secondPostId }),
    ).rejects.toThrow();
    expect(
      await listSocialPostDraftConnectionIds({
        ...input,
        postId: secondPostId,
      }),
    ).toEqual([]);
    expect(
      (
        await pg.query("select version from social_posts where id=$1", [
          secondPostId,
        ])
      ).rows[0],
    ).toEqual({ version: 1 });
    expect(
      (
        await pg.query("select * from social_post_targets where post_id=$1", [
          postId,
        ])
      ).rows,
    ).toHaveLength(0);
  });
  it("applies only the additive MCP migration and preserves existing tables", async () => {
    const [row] = (
      await pg.query<{ count: number }>(
        "select count(*)::int as count from social_posts where id=$1 and workspace_id=$2",
        [mcpIds.post, mcpIds.workspace],
      )
    ).rows;
    expect(row.count).toBe(1);
  });
  it("enforces workspace grants and idempotency uniqueness in PostgreSQL", async () => {
    const first = await beginMcpOperation(operationInput("unique-request"));
    const second = await beginMcpOperation(operationInput("unique-request"));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.operation.id).toBe(first.operation.id);
    await expect(
      beginMcpOperation({
        ...operationInput("foreign-workspace"),
        workspaceId: "88888888-8888-4888-8888-888888888888",
      }),
    ).rejects.toThrow();
  });
  it("consumes a correct proof exactly once and refuses foreign actors/workspaces", async () => {
    const { operation } = await beginMcpOperation(
      operationInput("single-use-proof"),
    );
    const base = {
      operationId: operation.id,
      workspaceId: mcpIds.workspace,
      connectionId,
      userId: mcpIds.user,
    };
    expect(
      await consumeMcpApproval({ ...base, approvalHash: "wrong" }),
    ).toBeNull();
    expect(
      await consumeMcpApproval({
        ...base,
        userId: mcpIds.asset,
        approvalHash: "proof-hash",
      }),
    ).toBeNull();
    expect(
      (await consumeMcpApproval({ ...base, approvalHash: "proof-hash" }))
        ?.status,
    ).toBe("approved");
    expect(
      await consumeMcpApproval({ ...base, approvalHash: "proof-hash" }),
    ).toBeNull();
  });
  it("saves text and attachments atomically, protects revisions and blocks edits after approval locking", async () => {
    const input = {
      workspaceId: mcpIds.workspace,
      postId: mcpIds.post,
      expectedVersion: 1,
      name: "Imported post",
      bodyPlainText: "Exact content",
      bodyDocument: { type: "doc" as const, content: [] },
      attachments: [{ source: "library" as const, id: mcpIds.asset }],
      connectionIds: [mcpIds.destination],
    };
    const result = await updateSocialPostDraft(input);
    expect(result.outcome).toBe("updated");
    expect(
      await listSocialPostDraftConnectionIds({
        workspaceId: mcpIds.workspace,
        postId: mcpIds.post,
      }),
    ).toEqual([mcpIds.destination]);
    expect(
      (
        await pg.query("select * from social_post_media where post_id=$1", [
          mcpIds.post,
        ])
      ).rows,
    ).toHaveLength(1);
    const invalid = {
      ...input,
      expectedVersion: 2,
      bodyPlainText: "must roll back",
      attachments: [
        {
          source: "library" as const,
          id: "99999999-9999-4999-8999-999999999999",
        },
      ],
    };
    await expect(updateSocialPostDraft(invalid)).rejects.toThrow();
    const row = (
      await pg.query<{ version: number; body_plain_text: string }>(
        "select version,body_plain_text from social_posts where id=$1 and workspace_id=$2",
        [mcpIds.post, mcpIds.workspace],
      )
    ).rows[0];
    expect(row).toEqual({ version: 2, body_plain_text: "Exact content" });
    const { operation } = await beginMcpOperation(operationInput("lock-post"));
    expect(
      await lockMcpPost({
        workspaceId: mcpIds.workspace,
        postId: mcpIds.post,
        expectedVersion: 1,
        operationId: operation.id,
      }),
    ).toBeNull();
    expect(
      await lockMcpPost({
        workspaceId: mcpIds.workspace,
        postId: mcpIds.post,
        expectedVersion: 2,
        operationId: operation.id,
      }),
    ).not.toBeNull();
    expect(
      (await updateSocialPostDraft({ ...input, expectedVersion: 2 })).outcome,
    ).toBe("conflict");
  });
  it("rechecks current membership and publishing grants when atomically consuming approval", async () => {
    const { operation } = await beginMcpOperation(
      operationInput("current-membership"),
    );
    const proof = {
      operationId: operation.id,
      workspaceId: mcpIds.workspace,
      connectionId,
      userId: mcpIds.user,
      approvalHash: "proof-hash",
    };
    await pg.exec("update workspace_members set role = 'viewer'");
    expect(await consumeMcpApproval(proof)).toBeNull();
    await pg.exec("update workspace_members set role = 'owner'");
    await saveMcpGrant({
      connectionId,
      userId: mcpIds.user,
      workspaceId: mcpIds.workspace,
      scopes: ["vcstudio:read"],
      publicationApprovalMode: "manual",
    });
    expect(await consumeMcpApproval(proof)).toBeNull();
    await saveMcpGrant({
      connectionId,
      userId: mcpIds.user,
      workspaceId: mcpIds.workspace,
      scopes: ["vcstudio:read", "vcstudio:publish"],
      publicationApprovalMode: "manual",
    });
    expect((await consumeMcpApproval(proof))?.status).toBe("approved");
  });
  it("protects brief edits from stale revisions and cross-workspace conflicts", async () => {
    const input = {
      workspaceId: mcpIds.workspace,
      projectId: mcpIds.post,
      userId: mcpIds.user,
      topic: "Original brief",
      targetAudience: "",
      tone: "",
      targetDurationSeconds: null,
      primaryPlatform: "youtube" as const,
      hookAngle: "",
      niche: "",
      expectedUpdatedAt: null,
    };
    const revision = await saveProjectBrief(input);
    expect(revision).toBeInstanceOf(Date);
    expect(
      await saveProjectBrief({ ...input, topic: "Stale overwrite" }),
    ).toBeNull();
    expect(
      await saveProjectBrief({
        ...input,
        expectedUpdatedAt: revision,
        workspaceId: "88888888-8888-4888-8888-888888888888",
      }),
    ).toBeNull();
    expect(
      await saveProjectBrief({
        ...input,
        expectedUpdatedAt: revision,
        topic: "Updated brief",
      }),
    ).toBeInstanceOf(Date);
  });
  it("deleting a project-owned scene copy preserves the shared library original", async () => {
    const { operation } = await beginMcpOperation(
      operationInput("reuse-provenance"),
    );
    const imageId = "77777777-7777-4777-8777-777777777777";
    await pg.query("insert into scene_image_generations values ($1,$2)", [
      imageId,
      mcpIds.workspace,
    ]);
    await pg.query(
      "insert into mcp_asset_origins (workspace_id,operation_id,media_asset_id,scene_image_id) values ($1,$2,$3,$4)",
      [mcpIds.workspace, operation.id, mcpIds.asset, imageId],
    );
    await pg.query(
      "delete from scene_image_generations where id=$1 and workspace_id=$2",
      [imageId, mcpIds.workspace],
    );
    expect(
      (await pg.query("select * from media_assets where id=$1", [mcpIds.asset]))
        .rows,
    ).toHaveLength(1);
    expect(
      (
        await pg.query(
          "select * from mcp_asset_origins where operation_id=$1",
          [operation.id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("claims publication and target replacement atomically, refusing a browser request that races an MCP lock", async () => {
    const postId = "99999999-9999-4999-8999-999999999999";
    await pg.query(
      "insert into social_posts (id,workspace_id) values ($1,$2)",
      [postId, mcpIds.workspace],
    );
    const { operation } = await beginMcpOperation(
      operationInput("dispatch-lock"),
    );
    await lockMcpPost({
      workspaceId: mcpIds.workspace,
      postId,
      expectedVersion: 1,
      operationId: operation.id,
    });
    const input = {
      workspaceId: mcpIds.workspace,
      postId,
      scheduledAt: new Date(),
      timezone: "UTC",
      dispatchNow: true,
      expectedVersion: 1,
      targets: [
        {
          platform: "linkedin" as const,
          connectionId: mcpIds.asset,
          overrideBodyPlainText: null,
          idempotencyKey: "target-key",
        },
      ],
    };
    expect(await scheduleSocialPost(input)).toBeNull();
    expect(
      (
        await pg.query("select * from social_post_targets where post_id=$1", [
          postId,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (await scheduleSocialPost({ ...input, mcpOperationId: operation.id }))
        ?.status,
    ).toBe("publishing");
    expect(
      await scheduleSocialPost({ ...input, mcpOperationId: operation.id }),
    ).toBeNull();
    expect(
      (
        await pg.query("select * from social_post_targets where post_id=$1", [
          postId,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("revocation clears queued secrets and pending approvals while retaining approved outbox entries", async () => {
    const pending = await beginMcpOperation({
      ...operationInput("cancel-pending", "queued"),
      sealedSource: "encrypted-source",
    });
    const approved = await beginMcpOperation(
      operationInput("keep-approved", "approved"),
    );
    await revokeMcpConnection(connectionId, mcpIds.user);
    const cancelled = await findMcpOperation({
      workspaceId: mcpIds.workspace,
      operationId: pending.operation.id,
    });
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.sealedSource).toBeNull();
    expect(
      (
        await findMcpOperation({
          workspaceId: mcpIds.workspace,
          operationId: approved.operation.id,
        })
      )?.status,
    ).toBe("approved");
  });
});
