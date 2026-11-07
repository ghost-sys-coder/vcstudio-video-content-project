import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const shared = vi.hoisted(() => ({ database: undefined as unknown }));
vi.mock("@/db/drizzle", () => ({ getDatabase: () => shared.database }));
import { saveAuthorizedSocialDraft } from "@/lib/social/save-social-draft";
import { scheduleSocialPost } from "@/db/commands/social-post-schedule-commands";
import {
  markSocialPostTargetPublished,
  reconcileSocialPostStatus,
} from "@/db/commands/social-post-target-commands";
import {
  findSocialPost,
  listSocialPostTargets,
} from "@/db/repositories/social-posts.repository";
import { socialYouTubeSettingsSchema } from "@studio/contracts/publishing";
const pg = new PGlite();
const w = "11111111-1111-4111-8111-111111111111",
  foreign = "22222222-2222-4222-8222-222222222222",
  post = "33333333-3333-4333-8333-333333333333",
  thumb = "44444444-4444-4444-8444-444444444444",
  foreignThumb = "55555555-5555-4555-8555-555555555555",
  youtube = "66666666-6666-4666-8666-666666666666",
  tiktok = "77777777-7777-4777-8777-777777777777";
const settings = socialYouTubeSettingsSchema.parse({
  title: "An exact video title",
  description: "Exact description",
  madeForKids: false,
  containsSyntheticMedia: true,
  visibility: "unlisted",
});
beforeAll(async () => {
  await pg.exec(`
    create type social_post_status as enum ('draft','scheduled','publishing','published','partially_failed','failed','cancelled');
    create type social_post_target_status as enum ('pending','queued','publishing','published','failed','cancelled');
    create type content_platform as enum ('youtube','tiktok');
    create table media_assets(id uuid primary key,workspace_id uuid not null,kind text default 'image',status text default 'ready',object_key text default 'image.png',content_type text default 'image/png',size_bytes int default 100,original_file_name text default 'thumbnail.png',title text default 'Thumbnail',alt_text text default '',tags jsonb default '[]',width int default 1080,height int default 1920,duration_milliseconds int,inspection_status text,verified_metadata jsonb,inspection_warnings jsonb default '[]',inspection_trigger_run_id text,inspection_error text,inspected_at timestamptz,uploaded_by_user_id uuid,deleted_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),unique(id,workspace_id));
    create table social_posts(id uuid primary key,workspace_id uuid not null,name text default '',body_document jsonb default '{"type":"doc","content":[]}',body_plain_text text default '',status social_post_status default 'draft',scheduled_at timestamptz,scheduled_timezone text default 'UTC',project_id uuid,version int default 1,mcp_operation_id uuid,created_by_user_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
    create table social_post_targets(id uuid primary key default gen_random_uuid(),post_id uuid,workspace_id uuid,platform content_platform,connection_id uuid,status social_post_target_status default 'pending',override_body_plain_text text,external_post_id text,external_post_url text,provider_operation_id text,provider_operation_secret_sealed text,attempt_count int default 0,trigger_run_id text,idempotency_key text unique,error_category text,safe_error_message text,published_at timestamptz,created_at timestamptz default now(),updated_at timestamptz default now(),unique(post_id,connection_id));
    create table social_post_media(id uuid primary key default gen_random_uuid(),post_id uuid,workspace_id uuid,media_asset_id uuid,render_id uuid,position int);
    create table social_post_draft_destinations(post_id uuid,workspace_id uuid,connection_id uuid);
    insert into media_assets(id,workspace_id) values ('${thumb}','${w}'),('${foreignThumb}','${foreign}');
    insert into social_posts(id,workspace_id,name) values ('${post}','${w}','Preserved draft');
  `);
  // Execute the generated migration as shipped, before testing real commands.
  await pg.exec(
    await readFile(
      "migrations/20261107211352_social_video_publication_settings/migration.sql",
      "utf8",
    ),
  );
  const db = drizzle({ client: pg });
  shared.database = Object.assign(db, {
    batch: (queries: { toSQL(): { sql: string; params: unknown[] } }[]) =>
      pg.transaction(async (tx) => {
        const result = [];
        for (const query of queries) {
          const sql = query.toSQL();
          result.push((await tx.query(sql.sql, sql.params)).rows);
        }
        return result;
      }),
  });
}, 30000);
afterAll(async () => {
  await pg.close();
});

describe("Social video migration and real PostgreSQL commands", () => {
  it("preserves existing business data and rejects cross-workspace thumbnails", async () => {
    expect(
      await findSocialPost({ workspaceId: w, postId: post }),
    ).toMatchObject({
      name: "Preserved draft",
      version: 1,
      youtubeSettings: null,
      youtubeThumbnailAssetId: null,
    });
    await expect(
      pg.query(
        "update social_posts set youtube_thumbnail_asset_id=$1 where id=$2",
        [foreignThumb, post],
      ),
    ).rejects.toThrow();
  });
  it("atomically saves thumbnail/settings, preserves omitted fields and rejects stale edits", async () => {
    const request = {
      postId: post,
      expectedVersion: 1,
      name: "YouTube draft",
      bodyDocument: { type: "doc", content: [] },
      attachments: [],
      youtubeSettings: settings,
      youtubeThumbnailAssetId: thumb,
    };
    expect(
      (
        await saveAuthorizedSocialDraft(
          { workspaceId: w, role: "owner" },
          request,
        )
      ).outcome,
    ).toBe("updated");
    expect(
      await findSocialPost({ workspaceId: w, postId: post }),
    ).toMatchObject({
      version: 2,
      youtubeSettings: settings,
      youtubeThumbnailAssetId: thumb,
    });
    expect(
      (
        await saveAuthorizedSocialDraft(
          { workspaceId: w, role: "owner" },
          request,
        )
      ).outcome,
    ).toBe("conflict");
    expect(
      (
        await saveAuthorizedSocialDraft(
          { workspaceId: w, role: "editor" },
          {
            ...request,
            expectedVersion: 2,
            youtubeSettings: undefined,
            youtubeThumbnailAssetId: undefined,
          },
        )
      ).outcome,
    ).toBe("updated");
    expect(
      await findSocialPost({ workspaceId: w, postId: post }),
    ).toMatchObject({
      version: 3,
      youtubeSettings: settings,
      youtubeThumbnailAssetId: thumb,
    });
    await expect(
      saveAuthorizedSocialDraft(
        { workspaceId: w, role: "viewer" },
        { ...request, expectedVersion: 3 },
      ),
    ).rejects.toThrow();
    await expect(
      saveAuthorizedSocialDraft(
        { workspaceId: w, role: "owner" },
        {
          ...request,
          expectedVersion: 3,
          youtubeThumbnailAssetId: foreignThumb,
        },
      ),
    ).rejects.toThrow("ready");
    expect(
      (await pg.query("select * from social_post_media")).rows,
    ).toHaveLength(0);
  });
  it("captures exact YouTube settings and thumbnail in the destination snapshot", async () => {
    const result = await scheduleSocialPost({
      workspaceId: w,
      postId: post,
      expectedVersion: 3,
      scheduledAt: new Date(Date.now() + 86400000),
      timezone: "Africa/Kampala",
      targets: [
        {
          platform: "youtube",
          connectionId: youtube,
          idempotencyKey: "youtube-1",
          overrideBodyPlainText: null,
          youtubeSettings: settings,
          youtubeThumbnailAssetId: thumb,
        },
        {
          platform: "tiktok",
          connectionId: tiktok,
          idempotencyKey: "tiktok-1",
          overrideBodyPlainText: null,
        },
      ],
    });
    expect(result).toMatchObject({ status: "scheduled", version: 4 });
    expect(
      (
        await saveAuthorizedSocialDraft(
          { workspaceId: w, role: "owner" },
          {
            postId: post,
            expectedVersion: 4,
            name: "YouTube draft",
            bodyDocument: { type: "doc", content: [] },
            attachments: [],
            youtubeSettings: { ...settings, title: "Unapproved replacement" },
            youtubeThumbnailAssetId: thumb,
          },
        )
      ).outcome,
    ).toBe("conflict");
    const targets = await listSocialPostTargets({
      workspaceId: w,
      postId: post,
    });
    expect(targets.find((t) => t.platform === "youtube")).toMatchObject({
      youtubeSettings: settings,
      youtubeThumbnailAssetId: thumb,
      youtubeThumbnailStatus: "pending",
    });
    expect(targets.find((t) => t.platform === "tiktok")).toMatchObject({
      youtubeSettings: null,
      youtubeThumbnailStatus: null,
    });
    await expect(
      pg.query("delete from media_assets where id=$1", [thumb]),
    ).rejects.toThrow();
  });
  it("persists inbox delivery without a publication date or fabricated URL and reconciles mixed destinations", async () => {
    const targets = await listSocialPostTargets({
      workspaceId: w,
      postId: post,
    });
    const yt = targets.find((t) => t.platform === "youtube")!,
      tk = targets.find((t) => t.platform === "tiktok")!;
    await markSocialPostTargetPublished({
      targetId: yt.id,
      externalPostId: "video123",
      externalPostUrl: "https://www.youtube.com/watch?v=video123",
    });
    await markSocialPostTargetPublished({
      targetId: tk.id,
      externalPostId: "inbox123",
      externalPostUrl: null,
      completionStage: "inbox_delivered",
    });
    await reconcileSocialPostStatus({ workspaceId: w, postId: post });
    expect(
      await findSocialPost({ workspaceId: w, postId: post }),
    ).toMatchObject({ status: "awaiting_completion" });
    expect(
      (await listSocialPostTargets({ workspaceId: w, postId: post })).find(
        (t) => t.platform === "tiktok",
      ),
    ).toMatchObject({
      status: "inbox_delivered",
      publishedAt: null,
      externalPostUrl: null,
    });
    await expect(
      pg.query(
        "update social_post_targets set status='inbox_delivered' where id=$1",
        [yt.id],
      ),
    ).rejects.toThrow();
    await expect(
      pg.query(
        "update social_post_targets set youtube_thumbnail_status='nonsense' where id=$1",
        [yt.id],
      ),
    ).rejects.toThrow();
  });
});
