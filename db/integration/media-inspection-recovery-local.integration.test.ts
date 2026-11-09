import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
vi.mock("server-only", () => ({}));
const pg = new PGlite();
const database = drizzle({ client: pg });
vi.mock("@/db/drizzle", () => ({ getDatabase: () => database }));
import {
  attachMediaAssetInspectionRun,
  claimMediaAssetInspectionRetry,
  failMediaAssetInspection,
} from "@/db/commands/media-inspection-commands";
import { listOutstandingMediaAssets } from "@/db/repositories/media-assets.repository";
const workspace = randomUUID(),
  other = randomUUID(),
  id = randomUUID();
beforeAll(async () => {
  await pg.exec(
    `create table media_assets(id uuid primary key, workspace_id uuid, kind text default 'video',status text default 'pending',object_key text default 'private',content_type text default 'video/mp4',size_bytes integer default 100,original_file_name text default 'video.mp4',title text default '',alt_text text default '',tags jsonb default '[]',width integer,height integer,duration_milliseconds integer,inspection_status text default 'pending',verified_metadata jsonb,inspection_warnings jsonb default '[]',inspection_trigger_run_id text,inspection_error text,inspected_at timestamptz,uploaded_by_user_id uuid,deleted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now());`,
  );
}, 30000);
beforeEach(async () => {
  await pg.exec("delete from media_assets");
  await pg.query(
    "insert into media_assets(id,workspace_id,inspection_trigger_run_id) values($1,$2,'run-new')",
    [id, workspace],
  );
});
afterAll(async () => pg.close());
describe("tenant-safe verification recovery SQL", () => {
  it("excludes incomplete uploads, deleted files and other workspaces from the recovery list", async () => {
    const failed = randomUUID();
    await pg.query(
      "insert into media_assets(id,workspace_id,status,inspection_status) values($1,$2,'failed','failed')",
      [failed, workspace],
    );
    await pg.query(
      "insert into media_assets(id,workspace_id,inspection_status) values($1,$2,null)",
      [randomUUID(), workspace],
    );
    await pg.query(
      "insert into media_assets(id,workspace_id,deleted_at) values($1,$2,now())",
      [randomUUID(), workspace],
    );
    await pg.query("insert into media_assets(id,workspace_id) values($1,$2)", [
      randomUUID(),
      other,
    ]);
    expect(
      new Set(
        (await listOutstandingMediaAssets({ workspaceId: workspace })).map(
          (asset) => asset.id,
        ),
      ),
    ).toEqual(new Set([id, failed]));
  });
  it("rejects old-run and foreign-workspace failures", async () => {
    await failMediaAssetInspection({
      workspaceId: other,
      mediaAssetId: id,
      message: "wrong workspace",
      expectedRunId: "run-new",
    });
    await failMediaAssetInspection({
      workspaceId: workspace,
      mediaAssetId: id,
      message: "old run",
      expectedRunId: "run-old",
    });
    expect(
      (
        await pg.query<{ status: string }>(
          "select status from media_assets where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("pending");
    await failMediaAssetInspection({
      workspaceId: workspace,
      mediaAssetId: id,
      message: "Stopped",
      expectedRunId: "run-new",
    });
    expect(
      (
        await pg.query<{ status: string }>(
          "select status from media_assets where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("failed");
  });
  it("gives exactly one concurrent retry the existing original and prevents a stale hook from failing it", async () => {
    await failMediaAssetInspection({
      workspaceId: workspace,
      mediaAssetId: id,
      message: "Stopped",
      expectedRunId: "run-new",
    });
    const input = {
      workspaceId: workspace,
      mediaAssetId: id,
      previousRunId: "run-new",
    };
    expect(
      (
        await Promise.all([
          claimMediaAssetInspectionRetry(input),
          claimMediaAssetInspectionRetry(input),
        ])
      ).filter(Boolean),
    ).toHaveLength(1);
    await failMediaAssetInspection({
      workspaceId: workspace,
      mediaAssetId: id,
      message: "Late old failure",
      expectedRunId: "run-new",
    });
    expect(
      await attachMediaAssetInspectionRun({
        workspaceId: workspace,
        mediaAssetId: id,
        triggerRunId: "run-retry",
      }),
    ).toBe(true);
    expect(
      await attachMediaAssetInspectionRun({
        workspaceId: workspace,
        mediaAssetId: id,
        triggerRunId: "run-stale",
      }),
    ).toBe(false);
  });
  it("keeps a ready video available after late failure and scopes the bounded processing list", async () => {
    await pg.query(
      "update media_assets set status='ready',inspection_status='succeeded' where id=$1",
      [id],
    );
    await failMediaAssetInspection({
      workspaceId: workspace,
      mediaAssetId: id,
      message: "Late failure",
      expectedRunId: "run-new",
    });
    expect(
      (
        await pg.query<{ status: string }>(
          "select status from media_assets where id=$1",
          [id],
        )
      ).rows[0].status,
    ).toBe("ready");
    for (let i = 0; i < 15; i++)
      await pg.query(
        "insert into media_assets(id,workspace_id) values($1,$2)",
        [randomUUID(), workspace],
      );
    await pg.query("insert into media_assets(id,workspace_id) values($1,$2)", [
      randomUUID(),
      other,
    ]);
    const rows = await listOutstandingMediaAssets({ workspaceId: workspace });
    expect(rows).toHaveLength(12);
    expect(
      rows.every(
        (row) => row.workspaceId === workspace && row.status === "pending",
      ),
    ).toBe(true);
  });
});
