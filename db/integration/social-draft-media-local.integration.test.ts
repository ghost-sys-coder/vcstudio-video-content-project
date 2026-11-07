import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const pg = new PGlite();
const database = drizzle({ client: pg });
vi.mock("@/db/drizzle", () => ({ getDatabase: () => database }));
import {
  findDraftAttachableMediaAssets,
  findReadyMediaAssets,
} from "@/db/repositories/media-assets.repository";
import { listSocialPostMedia } from "@/db/repositories/social-posts.repository";
import { saveAuthorizedSocialDraft } from "@/lib/social/save-social-draft";
const workspace = "11111111-1111-4111-8111-111111111111",
  foreign = "22222222-2222-4222-8222-222222222222";
const ids = Array.from(
  { length: 11 },
  (_, index) =>
    `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
beforeAll(async () => {
  await pg.exec(`create table media_assets (
    id uuid primary key, workspace_id uuid not null, kind text not null, status text not null,
    object_key text not null default 'key', content_type text not null default 'video/mp4', size_bytes integer not null default 10,
    original_file_name text not null default 'file', title text not null default '', alt_text text not null default '',
    tags jsonb not null default '[]', width integer, height integer, duration_milliseconds integer,
    inspection_status text, verified_metadata jsonb, inspection_warnings jsonb not null default '[]',
    inspection_trigger_run_id text, inspection_error text, inspected_at timestamptz, uploaded_by_user_id uuid not null,
    deleted_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  );
  create table social_posts (id uuid primary key, workspace_id uuid not null, name text not null default '', body_document jsonb not null default '{"type":"doc","content":[]}', body_plain_text text not null default '', status text not null default 'draft', version integer not null default 1, scheduled_at timestamptz, scheduled_timezone text not null default 'UTC', project_id uuid, created_by_user_id uuid, mcp_operation_id uuid, created_at timestamptz default now(), updated_at timestamptz default now());
  create table social_post_draft_destinations(post_id uuid, workspace_id uuid, connection_id uuid, unique(post_id,connection_id));
  create table social_post_media(id uuid primary key default gen_random_uuid(), post_id uuid not null, workspace_id uuid not null, media_asset_id uuid, render_id uuid, position int not null, unique(post_id,position), unique(post_id,media_asset_id));
  create table video_renders(id uuid primary key, workspace_id uuid, status text, asset_object_key text, asset_content_type text, asset_size_bytes int, width int, height int, duration_milliseconds int, output_duration_milliseconds int, created_at timestamptz);
  `);
  await pg.exec(
    "alter table social_posts add column youtube_settings jsonb, add column youtube_thumbnail_asset_id uuid;",
  );
  const rows = [
    [ids[0], workspace, "image", "ready", null, null],
    [ids[1], workspace, "video", "ready", "succeeded", null],
    [ids[2], workspace, "video", "pending", "pending", null],
    [ids[3], workspace, "video", "pending", "running", null],
    [ids[4], workspace, "video", "pending", null, null],
    [ids[5], workspace, "image", "pending", "pending", null],
    [ids[6], workspace, "video", "failed", "failed", null],
    [ids[7], foreign, "video", "ready", "succeeded", null],
    [ids[8], workspace, "video", "ready", "pending", null],
    [ids[9], workspace, "video", "ready", "failed", null],
    [ids[10], workspace, "video", "ready", null, null],
  ];
  for (const row of rows)
    await pg.query(
      "insert into media_assets(id,workspace_id,kind,status,inspection_status,deleted_at,uploaded_by_user_id) values ($1,$2,$3,$4,$5,$6,$2)",
      row,
    );
}, 30000);
afterAll(async () => {
  await pg.close();
});

describe("draft attachment validation on isolated PostgreSQL", () => {
  it("accepts ready media and only videos with an active inspection from the authorized workspace", async () => {
    const assets = await findDraftAttachableMediaAssets({
      workspaceId: workspace,
      mediaAssetIds: ids,
    });
    expect(assets.map((asset) => asset.id).sort()).toEqual(
      [...ids.slice(0, 4), ids[8], ids[10]].sort(),
    );
  });
  it("continues to require fully ready media for publication", async () => {
    const assets = await findReadyMediaAssets({
      workspaceId: workspace,
      mediaAssetIds: ids,
    });
    expect(assets.map((asset) => asset.id).sort()).toEqual(
      [...ids.slice(0, 2), ids[10]].sort(),
    );
  });
  it("loads pending draft attachments as unavailable and never leaks a foreign workspace's asset", async () => {
    const postId = "33333333-3333-4333-8333-333333333333";
    await pg.query(
      "insert into social_post_media values ($1,$2,$3,$4,null,0),($5,$2,$3,$6,null,1)",
      [
        "44444444-4444-4444-8444-444444444444",
        postId,
        workspace,
        ids[2],
        "55555555-5555-4555-8555-555555555555",
        ids[7],
      ],
    );
    const media = await listSocialPostMedia({ workspaceId: workspace, postId });
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      sourceId: ids[2],
      inspectionPending: true,
      unavailable: true,
    });
    await pg.query(
      "update media_assets set status='ready',inspection_status='succeeded' where id=$1",
      [ids[2]],
    );
    expect(
      (await listSocialPostMedia({ workspaceId: workspace, postId }))[0],
    ).toMatchObject({ sourceId: ids[2], unavailable: false });
  });
  it("saves a pending video to a draft and resolves it as unavailable until verification succeeds", async () => {
    const postId = "66666666-6666-4666-8666-666666666666";
    await pg.query(
      "insert into social_posts (id,workspace_id) values ($1,$2)",
      [postId, workspace],
    );
    const result = await saveAuthorizedSocialDraft(
      { workspaceId: workspace, role: "owner" },
      {
        postId,
        expectedVersion: 1,
        name: "Pending video",
        bodyDocument: { type: "doc", content: [] },
        attachments: [{ source: "library", id: ids[3] }],
      },
    );
    expect(result.outcome).toBe("updated");
    expect(
      (await listSocialPostMedia({ workspaceId: workspace, postId }))[0],
    ).toMatchObject({
      sourceId: ids[3],
      inspectionPending: true,
      unavailable: true,
    });
    expect(
      await findReadyMediaAssets({
        workspaceId: workspace,
        mediaAssetIds: [ids[3]!],
      }),
    ).toEqual([]);
    await pg.query(
      "update media_assets set status='ready',inspection_status='succeeded' where id=$1",
      [ids[3]],
    );
    expect(
      (await listSocialPostMedia({ workspaceId: workspace, postId }))[0],
    ).toMatchObject({ sourceId: ids[3], unavailable: false });
  });
  it("excludes soft-deleted media even if it was previously ready", async () => {
    await pg.query("update media_assets set deleted_at=now() where id=$1", [
      ids[0],
    ]);
    expect(
      await findDraftAttachableMediaAssets({
        workspaceId: workspace,
        mediaAssetIds: [ids[0]!],
      }),
    ).toEqual([]);
  });
});
