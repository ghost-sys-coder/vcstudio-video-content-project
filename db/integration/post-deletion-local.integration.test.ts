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
const pg = new PGlite(),
  database = drizzle({ client: pg });
vi.mock("@/db/drizzle", () => ({ getDatabase: () => database }));
import {
  deleteSocialPostWithMedia,
  getPostDeletionPreview,
} from "@/db/repositories/post-deletion.repository";
const workspace = randomUUID(),
  otherWorkspace = randomUUID(),
  postId = randomUUID(),
  assetId = randomUUID(),
  otherPostId = randomUUID();
const input = {
  workspaceId: workspace,
  postId,
  expectedVersion: 3,
  deleteMedia: false,
};
beforeAll(async () => {
  await pg.exec(`
    create table media_assets(id uuid primary key,workspace_id uuid not null,deleted_at timestamptz,updated_at timestamptz default now());
    create table social_posts(id uuid primary key,workspace_id uuid not null,name text default 'Test post',version int default 3,status text default 'draft',mcp_operation_id uuid,youtube_thumbnail_asset_id uuid references media_assets(id));
    create table social_post_media(id uuid primary key,workspace_id uuid not null,post_id uuid references social_posts(id) on delete cascade,media_asset_id uuid references media_assets(id),render_id uuid);
    create table social_post_targets(id uuid primary key,workspace_id uuid not null,post_id uuid references social_posts(id) on delete cascade,status text default 'pending',youtube_thumbnail_asset_id uuid references media_assets(id),youtube_thumbnail_status text);
    create table social_post_draft_destinations(id uuid primary key,post_id uuid references social_posts(id) on delete cascade);
    create table project_render_effects(workspace_id uuid,background_media_asset_id uuid);
    create table scene_visual_selections(workspace_id uuid,source_asset_id uuid);
    create table video_generations(workspace_id uuid,output_asset_id uuid,request jsonb);
    create table mcp_asset_origins(workspace_id uuid,media_asset_id uuid,scene_image_id uuid);
    create table marketing_brand_assets(workspace_id uuid,media_asset_id uuid);
    create table marketing_content_media(workspace_id uuid,media_asset_id uuid);
  `);
}, 30000);
beforeEach(async () => {
  await pg.exec(
    `truncate social_post_draft_destinations,social_post_targets,social_post_media,social_posts,media_assets,project_render_effects,scene_visual_selections,video_generations,mcp_asset_origins,marketing_brand_assets,marketing_content_media cascade`,
  );
  await pg.query("insert into media_assets(id,workspace_id) values($1,$2)", [
    assetId,
    workspace,
  ]);
  await pg.query(
    "insert into social_posts(id,workspace_id) values($1,$2),($3,$2)",
    [postId, workspace, otherPostId],
  );
  await pg.query(
    "insert into social_post_media(id,workspace_id,post_id,media_asset_id) values($1,$2,$3,$4)",
    [randomUUID(), workspace, postId, assetId],
  );
});
afterAll(async () => {
  await pg.close();
});
async function mediaDeleted() {
  return (
    await pg.query<{ deleted: boolean }>(
      "select deleted_at is not null as deleted from media_assets where id=$1",
      [assetId],
    )
  ).rows[0]?.deleted;
}
describe("atomic post deletion on isolated PostgreSQL", () => {
  it("previews saved attachments and defaults to keeping the library original", async () => {
    expect(await getPostDeletionPreview(input)).toMatchObject({
      postId,
      version: 3,
      status: "draft",
      mediaCount: 1,
      removableMediaCount: 1,
      canDelete: true,
    });
    expect(await deleteSocialPostWithMedia(input)).toEqual({
      deleted: true,
      status: "draft",
      removedMediaIds: [],
    });
    expect(await mediaDeleted()).toBe(false);
    expect(
      (
        await pg.query("select * from social_post_media where post_id=$1", [
          postId,
        ])
      ).rows,
    ).toEqual([]);
    expect(await deleteSocialPostWithMedia(input)).toEqual({ deleted: false });
  });
  it("atomically removes only eligible media when explicitly selected, retaining storage records", async () => {
    const result = await deleteSocialPostWithMedia({
      ...input,
      deleteMedia: true,
    });
    expect(result).toEqual({
      deleted: true,
      status: "draft",
      removedMediaIds: [assetId],
    });
    expect(await mediaDeleted()).toBe(true);
    expect(
      (await pg.query("select * from media_assets where id=$1", [assetId]))
        .rows,
    ).toHaveLength(1);
  });
  it("rejects stale versions and cross-workspace identifiers without touching media", async () => {
    expect(
      await getPostDeletionPreview({ ...input, workspaceId: otherWorkspace }),
    ).toBeNull();
    expect(
      await deleteSocialPostWithMedia({
        ...input,
        workspaceId: otherWorkspace,
        deleteMedia: true,
      }),
    ).toEqual({ deleted: false });
    expect(
      await deleteSocialPostWithMedia({
        ...input,
        expectedVersion: 2,
        deleteMedia: true,
      }),
    ).toEqual({ deleted: false });
    expect(await mediaDeleted()).toBe(false);
    expect(await getPostDeletionPreview(input)).not.toBeNull();
  });
  it.each([
    "draft",
    "scheduled",
    "published",
    "partially_failed",
    "failed",
    "cancelled",
    "awaiting_completion",
  ])(
    "deletes a stable %s record, its calendar entry and destination rows",
    async (status) => {
      await pg.query("update social_posts set status=$1 where id=$2", [
        status,
        postId,
      ]);
      await pg.query(
        "insert into social_post_targets(id,workspace_id,post_id,status) values($1,$2,$3,$4)",
        [
          randomUUID(),
          workspace,
          postId,
          status === "scheduled" ? "pending" : "published",
        ],
      );
      await pg.query(
        "insert into social_post_draft_destinations values($1,$2)",
        [randomUUID(), postId],
      );
      expect(await deleteSocialPostWithMedia(input)).toMatchObject({
        deleted: true,
        status,
      });
      expect(
        (
          await pg.query("select * from social_post_targets where post_id=$1", [
            postId,
          ])
        ).rows,
      ).toEqual([]);
      expect(
        (
          await pg.query(
            "select * from social_post_draft_destinations where post_id=$1",
            [postId],
          )
        ).rows,
      ).toEqual([]);
    },
  );
  it.each([
    "post_publishing",
    "queued",
    "publishing",
    "mcp_lock",
    "thumbnail_pending",
  ])("blocks %s work and preserves everything", async (state) => {
    if (state === "post_publishing")
      await pg.query(
        "update social_posts set status='publishing' where id=$1",
        [postId],
      );
    else if (state === "mcp_lock")
      await pg.query(
        "update social_posts set mcp_operation_id=$1 where id=$2",
        [randomUUID(), postId],
      );
    else if (state === "thumbnail_pending")
      await pg.query(
        "insert into social_post_targets(id,workspace_id,post_id,status,youtube_thumbnail_status) values($1,$2,$3,'published','pending')",
        [randomUUID(), workspace, postId],
      );
    else
      await pg.query(
        "insert into social_post_targets(id,workspace_id,post_id,status) values($1,$2,$3,$4)",
        [randomUUID(), workspace, postId, state],
      );
    expect(await getPostDeletionPreview(input)).toMatchObject({
      canDelete: false,
    });
    expect(
      await deleteSocialPostWithMedia({ ...input, deleteMedia: true }),
    ).toEqual({ deleted: false });
    expect(await mediaDeleted()).toBe(false);
  });
  it("rechecks a share added after preview and preserves the original", async () => {
    expect(await getPostDeletionPreview(input)).toMatchObject({
      removableMediaCount: 1,
    });
    await pg.query(
      "insert into social_post_media(id,workspace_id,post_id,media_asset_id) values($1,$2,$3,$4)",
      [randomUUID(), workspace, otherPostId, assetId],
    );
    expect(await getPostDeletionPreview(input)).toMatchObject({
      removableMediaCount: 0,
    });
    expect(
      await deleteSocialPostWithMedia({ ...input, deleteMedia: true }),
    ).toMatchObject({ deleted: true, removedMediaIds: [] });
    expect(await mediaDeleted()).toBe(false);
  });
  it("includes a distinct custom YouTube thumbnail, without double counting an attachment", async () => {
    await pg.query(
      "update social_posts set youtube_thumbnail_asset_id=$1 where id=$2",
      [assetId, postId],
    );
    expect(await getPostDeletionPreview(input)).toMatchObject({
      mediaCount: 1,
      removableMediaCount: 1,
    });
    await pg.query("delete from social_post_media where post_id=$1", [postId]);
    expect(await getPostDeletionPreview(input)).toMatchObject({
      mediaCount: 1,
      removableMediaCount: 1,
    });
    expect(
      await deleteSocialPostWithMedia({ ...input, deleteMedia: true }),
    ).toMatchObject({ deleted: true, removedMediaIds: [assetId] });
  });
  it.each([
    "post_thumbnail",
    "target_thumbnail",
    "background_audio",
    "scene_selection",
    "video_output",
    "video_input",
    "scene_original",
    "brand_asset",
    "marketing_content",
  ])("keeps media referenced as %s", async (reference) => {
    switch (reference) {
      case "post_thumbnail":
        await pg.query(
          "update social_posts set youtube_thumbnail_asset_id=$1 where id=$2",
          [assetId, otherPostId],
        );
        break;
      case "target_thumbnail":
        await pg.query(
          "insert into social_post_targets(id,workspace_id,post_id,youtube_thumbnail_asset_id) values($1,$2,$3,$4)",
          [randomUUID(), workspace, otherPostId, assetId],
        );
        break;
      case "background_audio":
        await pg.query("insert into project_render_effects values($1,$2)", [
          workspace,
          assetId,
        ]);
        break;
      case "scene_selection":
        await pg.query("insert into scene_visual_selections values($1,$2)", [
          workspace,
          assetId,
        ]);
        break;
      case "video_output":
        await pg.query("insert into video_generations values($1,$2,'{}')", [
          workspace,
          assetId,
        ]);
        break;
      case "video_input":
        await pg.query("insert into video_generations values($1,null,$2)", [
          workspace,
          JSON.stringify({ inputs: [{ assetId, role: "first_frame" }] }),
        ]);
        break;
      case "scene_original":
        await pg.query("insert into mcp_asset_origins values($1,$2,$3)", [
          workspace,
          assetId,
          randomUUID(),
        ]);
        break;
      case "brand_asset":
        await pg.query("insert into marketing_brand_assets values($1,$2)", [
          workspace,
          assetId,
        ]);
        break;
      case "marketing_content":
        await pg.query("insert into marketing_content_media values($1,$2)", [
          workspace,
          assetId,
        ]);
        break;
    }
    expect(await getPostDeletionPreview(input)).toMatchObject({
      mediaCount: 1,
      removableMediaCount: 0,
    });
    expect(
      await deleteSocialPostWithMedia({ ...input, deleteMedia: true }),
    ).toMatchObject({ deleted: true, removedMediaIds: [] });
    expect(await mediaDeleted()).toBe(false);
  });
  it("never deletes a project-owned render and hides media choice for text-only posts", async () => {
    await pg.query("delete from social_post_media where post_id=$1", [postId]);
    expect(await getPostDeletionPreview(input)).toMatchObject({
      mediaCount: 0,
      removableMediaCount: 0,
    });
    await pg.query(
      "insert into social_post_media(id,workspace_id,post_id,render_id) values($1,$2,$3,$4)",
      [randomUUID(), workspace, postId, randomUUID()],
    );
    expect(await getPostDeletionPreview(input)).toMatchObject({
      mediaCount: 1,
      removableMediaCount: 0,
    });
    expect(
      await deleteSocialPostWithMedia({ ...input, deleteMedia: true }),
    ).toMatchObject({ deleted: true, removedMediaIds: [] });
    expect(await mediaDeleted()).toBe(false);
  });
});
