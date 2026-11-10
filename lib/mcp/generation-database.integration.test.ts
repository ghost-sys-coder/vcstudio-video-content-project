import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mcpContextFixture, mcpIds } from "@/lib/test-utils/mcp-fixtures";
vi.mock("server-only", () => ({}));
const shared = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("@/db/drizzle", () => ({ getDatabase: () => shared.db }));
import { consumeMcpGeneration } from "@/db/repositories/mcp-generation.repository";
import { settleMcpGeneration } from "@/db/commands/mcp-generation-commands";
import { buildMcpGenerationReservationSql } from "@/db/commands/mcp-generation-reservation-sql";
import {
  findMcpConnection,
  findMcpGrant,
  findMcpOperation,
  updateMcpOperation,
} from "@/db/repositories/mcp.repository";
const pg = new PGlite();
const otherWorkspace = randomUUID(),
  legacyImage = randomUUID(),
  legacyVideo = randomUUID();
let originalRows: unknown[];
beforeAll(async () => {
  await pg.exec(`
    create table users(id uuid primary key); create table workspaces(id uuid primary key);
    create table workspace_members(workspace_id uuid,user_id uuid,role text);
    create table social_posts(id uuid primary key);
    create table media_assets(id uuid,workspace_id uuid,unique(id,workspace_id));
    create table scene_image_generations(id uuid,workspace_id uuid,unique(id,workspace_id));
    create table scene_audio_generations(id uuid,workspace_id uuid,unique(id,workspace_id));
    create type usage_operation_type as enum ('video_generation','scene_analysis','scene_image_generation','scene_audio_generation','video_render','script_generation','title_generation','thumbnail_generation','scene_video_generation','chapter_generation');
    create type usage_reservation_status as enum ('pending','reconciled','released');
    create type usage_event_type as enum ('reserved','reconciled','released');
    create table usage_reservations(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,project_id uuid,operation_type usage_operation_type not null,status usage_reservation_status not null default 'pending',reserved_cost_cents integer not null,actual_cost_cents integer,expires_at timestamptz not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),analysis_run_id uuid,image_generation_id uuid,audio_generation_id uuid,video_render_id uuid,script_generation_id uuid,title_generation_id uuid,thumbnail_generation_id uuid,clip_generation_id uuid,chapter_generation_id uuid,video_generation_id uuid, constraint usage_reservations_single_operation check(num_nonnulls(analysis_run_id,image_generation_id,audio_generation_id,video_render_id,script_generation_id,title_generation_id,thumbnail_generation_id,clip_generation_id,chapter_generation_id,video_generation_id)=1));
    create table usage_events(id uuid default gen_random_uuid(),workspace_id uuid,project_id uuid,reservation_id uuid,operation_type usage_operation_type,event_type usage_event_type,estimated_cost_cents integer,actual_cost_cents integer,safe_metadata jsonb,unique(reservation_id,event_type));
    insert into users values ('${mcpIds.user}'); insert into workspaces values ('${mcpIds.workspace}'),('${otherWorkspace}');
    insert into workspace_members values ('${mcpIds.workspace}','${mcpIds.user}','owner');
    insert into usage_reservations(workspace_id,project_id,operation_type,image_generation_id,reserved_cost_cents,expires_at) values ('${mcpIds.workspace}','${mcpIds.post}','scene_image_generation','${legacyImage}',3,now()+interval '1 hour');
    insert into usage_reservations(workspace_id,operation_type,video_generation_id,reserved_cost_cents,expires_at) values ('${mcpIds.workspace}','video_generation','${legacyVideo}',4,now()+interval '1 hour');
  `);
  await pg.exec(
    await readFile(
      "migrations/20261103225447_mcp_import_reuse_publish/migration.sql",
      "utf8",
    ),
  );
  await pg.exec(
    await readFile(
      "migrations/20261107223040_mcp_autonomous_publishing/migration.sql",
      "utf8",
    ),
  );
  await pg.exec(
    `insert into mcp_connections(id,user_id,client_id) values ('${mcpIds.connection}','${mcpIds.user}','https://client.example/metadata.json'); insert into mcp_workspace_grants(connection_id,workspace_id,scopes) values ('${mcpIds.connection}','${mcpIds.workspace}','["vcstudio:read","vcstudio:generate"]');`,
  );
  originalRows = (
    await pg.query(
      "select id,workspace_id,project_id,operation_type,image_generation_id,video_generation_id,reserved_cost_cents from usage_reservations order by id",
    )
  ).rows;
  await pg.exec(
    await readFile(
      "migrations/20261110001516_mcp_media_generation/migration.sql",
      "utf8",
    ),
  );
  shared.db = drizzle({ client: pg });
}, 30000);
afterAll(() => pg.close());
async function context() {
  const ctx = mcpContextFixture();
  const grant = await findMcpGrant(mcpIds.connection, mcpIds.workspace),
    connection = await findMcpConnection(mcpIds.connection, mcpIds.user);
  if (!grant || !connection) throw new Error("Missing fixture");
  return { ...ctx, grant, connection };
}
async function operation(status = "approved", workspaceId = mcpIds.workspace) {
  const id = randomUUID();
  await pg.query(
    "insert into mcp_operations(id,workspace_id,connection_id,user_id,kind,idempotency_key,fingerprint,status,input,approval_hash,expires_at) values ($1::uuid,$2,$3,$4,'generate_media',$1::text,'hash',$5,'{}','private-hash',now()+interval '1 hour')",
    [id, workspaceId, mcpIds.connection, mcpIds.user, status],
  );
  return id;
}
async function reserve(
  operationId: string,
  limit = 1000,
  workspaceId = mcpIds.workspace,
) {
  const q = new PgDialect().sqlToQuery(
    buildMcpGenerationReservationSql({
      operationId,
      workspaceId,
      estimatedCostCents: 5,
      maximumCostCents: 5,
      dailyBudgetCents: limit,
      monthlyBudgetCents: limit,
    }),
  );
  return (await pg.query<{ id: string | null }>(q.sql, q.params)).rows[0].id;
}
describe("generated MCP media migration and money-safe SQL", () => {
  it("does not overwrite a newer operation revision during recovery", async () => {
    const id = await operation("running");
    expect(
      await updateMcpOperation({
        workspaceId: mcpIds.workspace,
        operationId: id,
        from: ["running"],
        expectedUpdatedAt: new Date(0),
        values: { status: "failed" },
      }),
    ).toBeNull();
    expect(
      (
        await findMcpOperation({
          workspaceId: mcpIds.workspace,
          operationId: id,
        })
      )?.status,
    ).toBe("running");
  });
  it("preserves existing image/video reservations and defaults old grants to manual", async () => {
    expect(
      (
        await pg.query(
          "select id,workspace_id,project_id,operation_type,image_generation_id,video_generation_id,reserved_cost_cents from usage_reservations order by id",
        )
      ).rows,
    ).toEqual(originalRows);
    expect(
      (await findMcpGrant(mcpIds.connection, mcpIds.workspace))
        ?.generationApprovalMode,
    ).toBe("manual");
  });
  it("requires the Generate scope for an autonomous saved grant", async () => {
    await expect(
      pg.exec(
        `update mcp_workspace_grants set scopes='["vcstudio:read"]',generation_approval_mode='autonomous'`,
      ),
    ).rejects.toThrow();
  });
  it("reserves without a dummy project, reuses retries and settles exactly once", async () => {
    const id = await operation(),
      reservationId = await reserve(id);
    expect(reservationId).toBeTruthy();
    expect(await reserve(id)).toBe(reservationId);
    await settleMcpGeneration(mcpIds.workspace, id, 2);
    await settleMcpGeneration(mcpIds.workspace, id, 2);
    expect(
      (
        await pg.query(
          "select project_id,status,actual_cost_cents from usage_reservations where id=$1",
          [reservationId],
        )
      ).rows,
    ).toEqual([
      { project_id: null, status: "reconciled", actual_cost_cents: 2 },
    ]);
    expect(
      (
        await pg.query(
          "select count(*)::int total from usage_events where reservation_id=$1",
          [reservationId],
        )
      ).rows[0],
    ).toEqual({ total: 2 });
  });
  it("includes existing pipeline spend in workspace budget checks", async () => {
    const id = await operation();
    expect(await reserve(id, 1)).toBeNull();
    expect(
      (
        await pg.query(
          "select count(*)::int total from usage_reservations where media_generation_operation_id=$1",
          [id],
        )
      ).rows[0],
    ).toEqual({ total: 0 });
  });
  it("blocks cross-workspace reservation pointers and mixed operation pointers", async () => {
    const id = await operation();
    await expect(
      pg.query(
        "insert into usage_reservations(workspace_id,operation_type,media_generation_operation_id,reserved_cost_cents,expires_at) values ($1,'media_generation',$2,5,now())",
        [otherWorkspace, id],
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        "insert into usage_reservations(workspace_id,operation_type,media_generation_operation_id,image_generation_id,reserved_cost_cents,expires_at) values ($1,'media_generation',$2,$3,5,now())",
        [mcpIds.workspace, id, legacyImage],
      ),
    ).rejects.toThrow();
    expect(await reserve(id, 1000, otherWorkspace)).toBeNull();
  });
  it("atomically consumes an owner-autonomous quote and rejects replay and stale revisions", async () => {
    await pg.exec(
      "update mcp_workspace_grants set generation_approval_mode='autonomous',updated_at=now()",
    );
    const ctx = await context(),
      id = await operation("prepared");
    expect((await consumeMcpGeneration(ctx, id))?.status).toBe("approved");
    expect(await consumeMcpGeneration(ctx, id)).toBeNull();
    const staleId = await operation("prepared");
    await pg.exec(
      "update mcp_workspace_grants set updated_at=updated_at+interval '1 second'",
    );
    expect(await consumeMcpGeneration(ctx, staleId)).toBeNull();
  });
  it("requires an exact single-use proof for a manual quote, with user/workspace isolation", async () => {
    await pg.exec(
      "update mcp_workspace_grants set generation_approval_mode='manual',updated_at=now()",
    );
    const ctx = await context(),
      id = await operation("requires_approval");
    expect(await consumeMcpGeneration(ctx, id)).toBeNull();
    expect(await consumeMcpGeneration(ctx, id, "wrong")).toBeNull();
    expect(
      await findMcpOperation({ operationId: id, workspaceId: otherWorkspace }),
    ).toBeNull();
    expect(
      await consumeMcpGeneration(
        { ...ctx, principal: { ...ctx.principal, userId: randomUUID() } },
        id,
        "private-hash",
      ),
    ).toBeNull();
    expect(await consumeMcpGeneration(ctx, id, "private-hash")).toMatchObject({
      status: "approved",
      approvalHash: null,
    });
    expect(await consumeMcpGeneration(ctx, id, "private-hash")).toBeNull();
  });
  it("rejects revocation and membership downgrade at the database boundary", async () => {
    await pg.exec(
      "update mcp_workspace_grants set generation_approval_mode='autonomous',updated_at=now()",
    );
    const ctx = await context(),
      id = await operation("prepared");
    await pg.exec("update workspace_members set role='editor'");
    expect(await consumeMcpGeneration(ctx, id)).toBeNull();
    await pg.exec(
      "update workspace_members set role='owner'; update mcp_connections set revoked_at=now()",
    );
    expect(await consumeMcpGeneration(ctx, id)).toBeNull();
  });
});
