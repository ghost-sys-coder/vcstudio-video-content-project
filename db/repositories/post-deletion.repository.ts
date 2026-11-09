import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import type { PostDeletionPreview } from "@studio/contracts/publishing";

/** Narrow historical reference checks only; this never starts Marketing work. */
function unsharedMedia(postId: string) {
  return sql`
    not exists(select 1 from social_post_media r where r.workspace_id=a.workspace_id and r.media_asset_id=a.id and r.post_id<>${postId}::uuid)
    and not exists(select 1 from social_posts r where r.workspace_id=a.workspace_id and r.youtube_thumbnail_asset_id=a.id and r.id<>${postId}::uuid)
    and not exists(select 1 from social_post_targets r where r.workspace_id=a.workspace_id and r.youtube_thumbnail_asset_id=a.id and r.post_id<>${postId}::uuid)
    and not exists(select 1 from project_render_effects r where r.workspace_id=a.workspace_id and r.background_media_asset_id=a.id)
    and not exists(select 1 from scene_visual_selections r where r.workspace_id=a.workspace_id and r.source_asset_id=a.id)
    and not exists(select 1 from video_generations r where r.workspace_id=a.workspace_id and (r.output_asset_id=a.id or r.request->'inputs' @> jsonb_build_array(jsonb_build_object('assetId',a.id::text))))
    and not exists(select 1 from mcp_asset_origins r where r.workspace_id=a.workspace_id and r.media_asset_id=a.id and r.scene_image_id is not null)
    and not exists(select 1 from marketing_brand_assets r where r.workspace_id=a.workspace_id and r.media_asset_id=a.id)
    and not exists(select 1 from marketing_content_media r where r.workspace_id=a.workspace_id and r.media_asset_id=a.id)
  `;
}

function candidates(workspaceId: string, postId: string) {
  return sql`
    select a.id from media_assets a
    where a.workspace_id=${workspaceId}::uuid and a.deleted_at is null
    and (exists(select 1 from social_post_media m where m.post_id=${postId}::uuid and m.workspace_id=${workspaceId}::uuid and m.media_asset_id=a.id)
      or exists(select 1 from social_posts p where p.id=${postId}::uuid and p.workspace_id=${workspaceId}::uuid and p.youtube_thumbnail_asset_id=a.id))
    and ${unsharedMedia(postId)}
  `;
}

function canDeletePost() {
  return sql`p.status<>'publishing' and p.mcp_operation_id is null
    and not exists(select 1 from social_post_targets t where t.post_id=p.id and t.workspace_id=p.workspace_id and (t.status in ('queued','publishing') or t.youtube_thumbnail_status='pending'))`;
}

export async function getPostDeletionPreview(input: {
  workspaceId: string;
  postId: string;
}): Promise<PostDeletionPreview | null> {
  const result = await getDatabase().execute<{
    id: string;
    name: string;
    version: number;
    status: string;
    media_count: number;
    removable_media_count: number;
    can_delete: boolean;
  }>(sql`
    select p.id,p.name,p.version,p.status::text,
      ((select count(*) from social_post_media m where m.post_id=p.id and m.workspace_id=p.workspace_id)
       + case when p.youtube_thumbnail_asset_id is not null and not exists(select 1 from social_post_media m where m.post_id=p.id and m.media_asset_id=p.youtube_thumbnail_asset_id) then 1 else 0 end)::int as media_count,
      (select count(*)::int from (${candidates(input.workspaceId, input.postId)}) removable) as removable_media_count,
      (${canDeletePost()}) as can_delete
    from social_posts p where p.id=${input.postId}::uuid and p.workspace_id=${input.workspaceId}::uuid limit 1
  `);
  const row = result.rows[0];
  return row
    ? {
        postId: row.id,
        name: row.name,
        version: row.version,
        status: row.status,
        mediaCount: row.media_count,
        removableMediaCount: row.removable_media_count,
        canDelete: row.can_delete,
      }
    : null;
}

/** One atomic statement: schedule claim/version changes prevent all deletion. */
export async function deleteSocialPostWithMedia(input: {
  workspaceId: string;
  postId: string;
  expectedVersion: number;
  deleteMedia: boolean;
}) {
  const result = await getDatabase().execute<{
    status: string;
    removed_media_ids: string[];
  }>(sql`
    with removable as materialized (select id from (${candidates(input.workspaceId, input.postId)}) a where ${input.deleteMedia}),
    deleted as (
      delete from social_posts p where p.id=${input.postId}::uuid and p.workspace_id=${input.workspaceId}::uuid
        and p.version=${input.expectedVersion} and ${canDeletePost()}
        and (select count(*) from removable)>=0
      returning p.id,p.status::text
    ), removed_media as (
      update media_assets a set deleted_at=now(),updated_at=now()
      where ${input.deleteMedia} and a.workspace_id=${input.workspaceId}::uuid
        and a.id in(select id from removable) and exists(select 1 from deleted)
        and a.deleted_at is null and ${unsharedMedia(input.postId)}
      returning a.id
    )
    select d.status,coalesce((select array_agg(id) from removed_media),'{}'::uuid[]) as removed_media_ids from deleted d
  `);
  const row = result.rows[0];
  return row
    ? {
        deleted: true as const,
        status: row.status,
        removedMediaIds: row.removed_media_ids,
      }
    : { deleted: false as const };
}
