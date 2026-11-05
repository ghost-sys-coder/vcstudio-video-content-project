import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db/drizzle", () => ({ getDatabase: () => databaseAdapter }));
import { deleteProject } from "@/db/commands/delete-project.command";
import { appendSceneVisualSelection } from "@/db/commands/scene-visual-selection-command";
import {
  buildVideoReservationSql,
  type ReserveVideoInput,
} from "@/db/commands/video-generation-reservation-sql";
import {
  syntheticVideoModel,
  syntheticVideoPricing,
  syntheticVideoRequest,
} from "@/lib/video-generation/video-generation-fixtures";

const pg = new PGlite();
const database = drizzle({ client: pg });
const databaseAdapter = {
  select: database.select.bind(database),
  update: database.update.bind(database),
  delete: database.delete.bind(database),
  execute: async (query: SQL) => {
    const compiled = new PgDialect().sqlToQuery(query);
    return pg.query(compiled.sql, compiled.params);
  },
  batch: async (
    queries: readonly { toSQL: () => { sql: string; params: unknown[] } }[],
  ) =>
    pg.transaction(async (transaction) => {
      const results: Record<string, unknown>[][] = [];
      for (const query of queries) {
        const compiled = query.toSQL();
        results.push(
          (
            await transaction.query<Record<string, unknown>>(
              compiled.sql,
              compiled.params,
            )
          ).rows,
        );
      }
      return results;
    }),
};
const workspace = randomUUID(),
  otherWorkspace = randomUUID(),
  user = randomUUID(),
  project = randomUUID(),
  scene = randomUUID(),
  version = randomUUID();
beforeAll(async () => {
  await pg.exec(`
    create type usage_operation_type as enum ('scene_analysis','scene_image_generation','scene_audio_generation','video_render','script_generation','title_generation','thumbnail_generation','scene_video_generation','chapter_generation');
    create type usage_reservation_status as enum ('pending','reconciled','released');
    create type usage_event_type as enum ('reserved','reconciled','released');
    create table workspaces(id uuid primary key); create table users(id uuid primary key);
    create table projects(id uuid primary key, workspace_id uuid not null references workspaces(id), maximum_budget_cents int not null, archived_at timestamptz, unique(id,workspace_id));
    create table scenes(id uuid primary key,workspace_id uuid,project_id uuid references projects(id) on delete cascade,current_version int);
    create table scene_versions(id uuid primary key,scene_id uuid references scenes(id) on delete cascade,project_id uuid,workspace_id uuid,version_number int,unique(id,scene_id,project_id,workspace_id));
    create table media_assets(id uuid primary key,workspace_id uuid,unique(id,workspace_id));
    create table usage_reservations(id uuid primary key,workspace_id uuid not null,project_id uuid not null,operation_type usage_operation_type not null,analysis_run_id uuid,image_generation_id uuid,audio_generation_id uuid,video_render_id uuid,script_generation_id uuid,title_generation_id uuid,thumbnail_generation_id uuid,clip_generation_id uuid,chapter_generation_id uuid,status usage_reservation_status not null default 'pending',reserved_cost_cents int not null,actual_cost_cents int,expires_at timestamptz not null,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),constraint usage_reservations_single_operation check(project_id is not null));
    create table usage_events(id uuid primary key default gen_random_uuid(),workspace_id uuid not null,project_id uuid not null,reservation_id uuid not null,operation_type usage_operation_type not null,event_type usage_event_type not null,estimated_cost_cents int not null,actual_cost_cents int,safe_metadata jsonb not null default '{}',unique(reservation_id,event_type));
    insert into workspaces values ('${workspace}'),('${otherWorkspace}');insert into users values ('${user}');
    insert into projects values ('${project}','${workspace}',0,null);
    insert into scenes values ('${scene}','${workspace}','${project}',1);
    insert into scene_versions values ('${version}','${scene}','${project}','${workspace}',1);
  `);
  const migration = await readFile(
    "migrations/20261105015230_video_studio_foundation/migration.sql",
    "utf8",
  );
  for (const statement of migration.split("--> statement-breakpoint"))
    if (statement.trim()) await pg.exec(statement);
  for (const statement of (
    await readFile(
      "migrations/20261105022142_video_accounting_retention/migration.sql",
      "utf8",
    )
  ).split("--> statement-breakpoint"))
    if (statement.trim()) await pg.exec(statement);
  for (const name of [
    "scene_variant_framings",
    "short_clips",
    "video_publications",
    "video_renders",
    "short_compositions",
    "scene_image_generations",
    "project_output_variants",
    "scene_analysis_runs",
  ])
    await pg.exec(
      `create table ${name}(id uuid primary key,project_id uuid,workspace_id uuid);`,
    );
}, 30000);
afterAll(() => pg.close());
function input(overrides: Partial<ReserveVideoInput> = {}): ReserveVideoInput {
  return {
    id: randomUUID(),
    reservationId: randomUUID(),
    workspaceId: workspace,
    userId: user,
    quoteId: randomUUID(),
    idempotencyKey: randomUUID(),
    fingerprint: "a".repeat(64),
    request: syntheticVideoRequest,
    model: syntheticVideoModel,
    pricing: syntheticVideoPricing,
    inputAssets: [],
    finalPrompt: "A test video.",
    promptTemplateVersion: "test-v1",
    estimatedCostCents: 11,
    dailyBudgetCents: 100,
    monthlyBudgetCents: 100,
    videoDailyBudgetCents: 100,
    videoLifetimeBudgetCents: 100,
    maximumCostCents: 100,
    ...overrides,
  };
}
async function reserve(value: ReserveVideoInput) {
  const q = new PgDialect().sqlToQuery(buildVideoReservationSql(value));
  return (
    await pg.query<{
      id: string | null;
      result: string;
      recorded_events: number;
    }>(q.sql, q.params)
  ).rows[0]!;
}
describe("video reservations on isolated PostgreSQL", () => {
  it("creates a direct job and ledger entries atomically without a project", async () => {
    const value = input();
    expect(await reserve(value)).toEqual({
      id: value.id,
      result: "allowed",
      recorded_events: 1,
    });
    expect(
      (
        await pg.query(
          "select project_id,reserved_cost_cents from usage_reservations where video_generation_id=$1",
          [value.id],
        )
      ).rows,
    ).toEqual([{ project_id: null, reserved_cost_cents: 11 }]);
    expect(await reserve(value)).toEqual({
      id: value.id,
      result: "existing",
      recorded_events: 0,
    });
    expect(
      (await reserve({ ...value, fingerprint: "b".repeat(64) })).result,
    ).toBe("idempotency_conflict");
    expect((await reserve({ ...input(), quoteId: value.quoteId })).result).toBe(
      "quote_used",
    );
    await pg.query(
      "update video_generations set status='succeeded' where id=$1",
      [value.id],
    );
  });
  it("refuses overspending before creating either job or reservation", async () => {
    for (const overrides of [
      { maximumCostCents: 1 },
      { dailyBudgetCents: 1 },
      { monthlyBudgetCents: 1 },
      { videoDailyBudgetCents: 1 },
      { videoLifetimeBudgetCents: 1 },
    ]) {
      const value = input(overrides);
      expect((await reserve(value)).id).toBeNull();
      expect(
        (
          await pg.query("select id from video_generations where id=$1", [
            value.id,
          ])
        ).rows,
      ).toHaveLength(0);
    }
  });
  it("enforces project budget, scene tenant and current revision", async () => {
    const target = {
      kind: "scene" as const,
      projectId: project,
      sceneId: scene,
      sceneVersionId: version,
      expectedSceneVersion: 1,
    };
    expect(
      (await reserve(input({ request: { ...syntheticVideoRequest, target } })))
        .result,
    ).toBe("project_budget_or_revision");
    await pg.query("update projects set maximum_budget_cents=100 where id=$1", [
      project,
    ]);
    expect(
      (
        await reserve(
          input({
            workspaceId: otherWorkspace,
            request: { ...syntheticVideoRequest, target },
          }),
        )
      ).result,
    ).toBe("project_budget_or_revision");
    expect(
      (
        await reserve(
          input({
            request: {
              ...syntheticVideoRequest,
              target: { ...target, expectedSceneVersion: 2 },
            },
          }),
        )
      ).result,
    ).toBe("project_budget_or_revision");
    const value = input({ request: { ...syntheticVideoRequest, target } });
    expect((await reserve(value)).result).toBe("allowed");
    await pg.query(
      "update video_generations set status='requires_reconciliation' where id=$1",
      [value.id],
    );
    expect((await reserve(input())).result).toBe("unresolved_request");
  });
  it("does not let null project IDs bypass workspace isolation or operation checks", async () => {
    const reservation = (
      await pg.query<{ id: string }>(
        "select id from usage_reservations limit 1",
      )
    ).rows[0]!;
    await expect(
      pg.query(
        "insert into usage_events(workspace_id,project_id,reservation_id,operation_type,event_type,estimated_cost_cents) values($1,null,$2,'video_generation','released',0)",
        [otherWorkspace, reservation.id],
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        "insert into usage_reservations(id,workspace_id,project_id,operation_type,reserved_cost_cents,expires_at) values($1,$2,null,'scene_analysis',1,now())",
        [randomUUID(), workspace],
      ),
    ).rejects.toThrow();
  });
  it("appends revision-bound scene selections and rejects null metadata or foreign workspaces", async () => {
    const source = randomUUID();
    await pg.query("insert into media_assets(id,workspace_id) values($1,$2)", [
      source,
      workspace,
    ]);
    const base = {
      workspaceId: workspace,
      projectId: project,
      sceneId: scene,
      sceneVersionId: version,
      expectedSceneVersion: 1,
      expectedRevision: 0,
      userId: user,
    };
    const selection = {
      id: randomUUID(),
      kind: "video" as const,
      sourceAssetId: source,
      objectKey: "project/copy.mp4",
      width: 1280,
      height: 720,
      durationMilliseconds: 6000,
      fit: "contain" as const,
      trimStartMilliseconds: 0,
      loop: false,
      reviewStatus: "pending" as const,
    };
    await expect(
      appendSceneVisualSelection({
        ...base,
        selection: { ...selection, width: null },
      }),
    ).rejects.toThrow();
    await expect(
      appendSceneVisualSelection({
        ...base,
        workspaceId: otherWorkspace,
        selection,
      }),
    ).rejects.toThrow();
    await appendSceneVisualSelection({ ...base, selection });
    await appendSceneVisualSelection({
      ...base,
      expectedRevision: 1,
      selection: { ...selection, id: randomUUID(), reviewStatus: "approved" },
    });
    await expect(
      appendSceneVisualSelection({
        ...base,
        selection: { ...selection, id: randomUUID() },
      }),
    ).rejects.toThrow();
    expect(
      (
        await pg.query(
          "select revision,review_status from scene_visual_selections where scene_version_id=$1 order by revision",
          [version],
        )
      ).rows,
    ).toEqual([
      { revision: 1, review_status: "pending" },
      { revision: 2, review_status: "approved" },
    ]);
  });
  it("blocks deletion while video accounting is pending, then preserves charges and workspace outputs", async () => {
    const sceneJob = (
      await pg.query<{ id: string }>(
        "select id from video_generations where project_id=$1",
        [project],
      )
    ).rows[0]!;
    await expect(
      deleteProject({ workspaceId: workspace, projectId: project }),
    ).rejects.toThrow();
    expect(
      (await pg.query("select id from projects where id=$1", [project])).rows,
    ).toHaveLength(1);
    await pg.query(
      "update usage_reservations set status='reconciled',actual_cost_cents=11 where video_generation_id=$1",
      [sceneJob.id],
    );
    const before = (
      await pg.query(
        "select sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) as total from usage_reservations",
      )
    ).rows[0];
    const original = randomUUID();
    await pg.query("insert into media_assets(id,workspace_id) values($1,$2)", [
      original,
      workspace,
    ]);
    expect(
      await deleteProject({ workspaceId: workspace, projectId: project }),
    ).toEqual({ deleted: true });
    expect(
      (
        await pg.query(
          "select project_id,target_detached,request->'target'->>'kind' as source_kind from video_generations where id=$1",
          [sceneJob.id],
        )
      ).rows,
    ).toEqual([
      { project_id: null, target_detached: true, source_kind: "scene" },
    ]);
    expect(
      (
        await pg.query(
          "select sum(case when status='pending' then reserved_cost_cents else coalesce(actual_cost_cents,0) end) as total from usage_reservations",
        )
      ).rows[0],
    ).toEqual(before);
    expect(
      (await pg.query("select id from media_assets where id=$1", [original]))
        .rows,
    ).toHaveLength(1);
  });
});
