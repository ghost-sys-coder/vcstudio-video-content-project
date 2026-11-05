import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
/** One bounded page, current scene versions only. Unselected historical media
 * cannot make a video scene look complete or require an irrelevant still. */
export async function loadVideoProductionFacts(input: {
  workspaceId: string;
  projectIds: string[];
}) {
  if (!input.projectIds.length)
    return new Map<
      string,
      {
        imagesSucceeded: number;
        imagesAwaitingReview: number;
        imagesFailed: number;
        imagesMissing: number;
        videosSucceeded: number;
        videosAwaitingReview: number;
        videosMissing: number;
        videosTooShort: number;
      }
    >();
  const result = await getDatabase().execute<{
    project_id: string;
    images_succeeded: number;
    images_review: number;
    images_failed: number;
    images_missing: number;
    videos_succeeded: number;
    videos_review: number;
    videos_missing: number;
    videos_short: number;
  }>(sql`
    with current_media as (
      select s.id,s.project_id,p.frames_per_second as fps,sv.id as version_id,coalesce(nullif(v.kind,'inherit'),p.default_visual_media) as visual_kind,
      v.kind,v.object_key,v.review_status,v.duration_milliseconds,v.trim_start_milliseconds,v.loop,
      (select a.duration_milliseconds from scene_audio_generations a where a.scene_version_id=sv.id and a.workspace_id=s.workspace_id and a.status='succeeded' and a.review_status='approved' order by a.created_at desc limit 1) as audio_duration
      from scenes s join projects p on p.id=s.project_id and p.workspace_id=s.workspace_id
      join scene_versions sv on sv.scene_id=s.id and sv.version_number=s.current_version and sv.workspace_id=s.workspace_id and sv.project_id=s.project_id
      left join lateral(select * from scene_visual_selections v where v.scene_version_id=sv.id and v.workspace_id=s.workspace_id order by v.revision desc limit 1) v on true
      where s.workspace_id=${input.workspaceId}::uuid and s.project_id in (${sql.join(
        input.projectIds.slice(0, 100).map((id) => sql`${id}::uuid`),
        sql`,`,
      )})
    ), images as (
      select c.id,c.project_id,
      count(*) filter(where i.status='succeeded')::int as succeeded,
      count(*) filter(where i.status='succeeded' and i.review_status='pending')::int as awaiting_review,
      count(*) filter(where i.status='failed')::int as failed
      from current_media c left join scene_image_generations i on i.scene_version_id=c.version_id and i.workspace_id=${input.workspaceId}::uuid
      where c.visual_kind='image' group by c.id,c.project_id
    ), image_totals as (
      select project_id,sum(succeeded)::int as succeeded,sum(awaiting_review)::int as awaiting_review,sum(failed)::int as failed,count(*) filter(where succeeded=0)::int as missing from images group by project_id
    )
    select c.project_id,coalesce(i.succeeded,0)::int as images_succeeded,coalesce(i.awaiting_review,0)::int as images_review,coalesce(i.failed,0)::int as images_failed,coalesce(i.missing,0)::int as images_missing,
      count(*) filter(where c.visual_kind='video' and c.kind='video' and c.object_key is not null)::int as videos_succeeded,
      count(*) filter(where c.visual_kind='video' and c.kind='video' and c.review_status='pending')::int as videos_review,
      count(*) filter(where c.visual_kind='video' and (c.kind is distinct from 'video' or c.object_key is null or c.review_status='rejected'))::int as videos_missing,
      count(*) filter(where c.visual_kind='video' and c.kind='video' and not c.loop and c.audio_duration is not null and c.duration_milliseconds-c.trim_start_milliseconds<c.audio_duration-(1000.0/c.fps))::int as videos_short
    from current_media c left join image_totals i on i.project_id=c.project_id group by c.project_id,i.succeeded,i.awaiting_review,i.failed,i.missing
  `);
  return new Map(
    result.rows.map((row) => [
      row.project_id,
      {
        imagesSucceeded: Number(row.images_succeeded),
        imagesAwaitingReview: Number(row.images_review),
        imagesFailed: Number(row.images_failed),
        imagesMissing: Number(row.images_missing),
        videosSucceeded: Number(row.videos_succeeded),
        videosAwaitingReview: Number(row.videos_review),
        videosMissing: Number(row.videos_missing),
        videosTooShort: Number(row.videos_short),
      },
    ]),
  );
}
