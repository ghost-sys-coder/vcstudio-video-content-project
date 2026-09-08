import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import type { SceneContent } from "@/lib/schemas/scene";
import { SceneRevisionConflictError } from "@/lib/domain/scene-revision";

/** One statement: losing the optimistic claim cannot insert an orphan revision. */
export async function saveSceneRevision(
  input: SceneContent & {
    workspaceId: string;
    projectId: string;
    sceneId: string;
    expectedVersion: number;
    previousVersionId: string;
    analysisRunId: string;
    startTimeMilliseconds: number;
    userId: string;
    compatibility: { image: boolean; audio: boolean };
  },
) {
  const versionId = crypto.randomUUID();
  const result = await getDatabase().execute<{ id: string }>(sql`
    with claimed as (
      update scenes set current_version = current_version + 1,
        status = 'review', updated_at = now()
      where id = ${input.sceneId}::uuid
        and workspace_id = ${input.workspaceId}::uuid
        and project_id = ${input.projectId}::uuid
        and current_version = ${input.expectedVersion}
        and analysis_run_id = ${input.analysisRunId}::uuid
        and analysis_run_id = (
          select id from scene_analysis_runs
          where workspace_id = ${input.workspaceId}::uuid
            and project_id = ${input.projectId}::uuid and status = 'completed'
          order by completed_at desc limit 1
        )
      returning id, current_version
    ), inserted as (
      insert into scene_versions (
        id, workspace_id, project_id, scene_id, version_number,
        narration_text, visual_description, location_description, action_description,
        camera_shot, camera_angle, camera_motion, emotional_tone,
        character_names, prop_names, continuity_notes, estimated_duration_milliseconds,
        start_time_milliseconds, end_time_milliseconds, created_by_user_id
      ) select ${versionId}::uuid, ${input.workspaceId}::uuid, ${input.projectId}::uuid,
        id, current_version, ${input.narrationText}, ${input.visualDescription},
        ${input.locationDescription}, ${input.actionDescription}, ${input.cameraShot},
        ${input.cameraAngle}, ${input.cameraMotion}, ${input.emotionalTone},
        ${JSON.stringify(input.characterNames)}::jsonb, ${JSON.stringify(input.propNames)}::jsonb,
        ${input.continuityNotes}, ${input.estimatedDurationMilliseconds},
        ${input.startTimeMilliseconds},
        ${input.startTimeMilliseconds + input.estimatedDurationMilliseconds}, ${input.userId}::uuid
      from claimed returning id
    ), copied_cast as (
      insert into scene_version_characters (
        workspace_id, project_id, scene_version_id, character_id,
        stage_slot, is_speaker, assigned_by_user_id
      ) select ${input.workspaceId}::uuid, ${input.projectId}::uuid, inserted.id,
        cast_row.character_id, cast_row.stage_slot, cast_row.is_speaker, ${input.userId}::uuid
      from inserted cross join scene_version_characters cast_row
      where cast_row.workspace_id = ${input.workspaceId}::uuid
        and cast_row.project_id = ${input.projectId}::uuid
        and cast_row.scene_version_id = ${input.previousVersionId}::uuid
      returning id
    ), image_candidates as (
      select g.id, g.size, 0 as priority from scene_image_generations g
      where g.workspace_id = ${input.workspaceId}::uuid and g.project_id = ${input.projectId}::uuid
        and g.scene_version_id = ${input.previousVersionId}::uuid
        and g.purpose = 'scene' and g.status = 'succeeded' and g.review_status = 'approved' and g.asset_object_key is not null
      union all
      select g.id, g.size, 1 from scene_revision_media b join scene_image_generations g on g.id = b.image_generation_id
      where b.workspace_id = ${input.workspaceId}::uuid and b.project_id = ${input.projectId}::uuid
        and b.scene_version_id = ${input.previousVersionId}::uuid
        and g.workspace_id = b.workspace_id and g.project_id = b.project_id and g.scene_id = b.scene_id
        and g.purpose = 'scene' and g.status = 'succeeded' and g.review_status = 'approved' and g.asset_object_key is not null
    ), audio_candidates as (
      select g.id, 0 as priority from scene_audio_generations g
      where g.workspace_id = ${input.workspaceId}::uuid and g.project_id = ${input.projectId}::uuid
        and g.scene_version_id = ${input.previousVersionId}::uuid
        and g.status = 'succeeded' and g.review_status = 'approved' and g.asset_object_key is not null
      union all
      select g.id, 1 from scene_revision_media b join scene_audio_generations g on g.id = b.audio_generation_id
      where b.workspace_id = ${input.workspaceId}::uuid and b.project_id = ${input.projectId}::uuid
        and b.scene_version_id = ${input.previousVersionId}::uuid
        and g.workspace_id = b.workspace_id and g.project_id = b.project_id and g.scene_id = b.scene_id
        and g.status = 'succeeded' and g.review_status = 'approved' and g.asset_object_key is not null
    ), reused_images as (
      insert into scene_revision_media (workspace_id, project_id, scene_id, scene_version_id, slot, image_generation_id, created_by_user_id)
      select ${input.workspaceId}::uuid, ${input.projectId}::uuid, ${input.sceneId}::uuid, inserted.id, candidate.size, candidate.id, ${input.userId}::uuid
      from inserted cross join (select distinct on (size) id, size from image_candidates order by size, priority) candidate
      where ${input.compatibility.image} returning id
    ), reused_audio as (
      insert into scene_revision_media (workspace_id, project_id, scene_id, scene_version_id, slot, audio_generation_id, created_by_user_id)
      select ${input.workspaceId}::uuid, ${input.projectId}::uuid, ${input.sceneId}::uuid, inserted.id, 'audio', candidate.id, ${input.userId}::uuid
      from inserted cross join (select id from audio_candidates order by priority limit 1) candidate
      where ${input.compatibility.audio} returning id
    ), copied_framing as (
      insert into scene_variant_framings (workspace_id, project_id, output_variant_id, scene_id, scene_version_id, source_image_generation_id, mode, focal_point_x_bps, focal_point_y_bps, scale_bps, background_color, updated_by_user_id)
      select f.workspace_id, f.project_id, f.output_variant_id, f.scene_id, inserted.id, f.source_image_generation_id, f.mode, f.focal_point_x_bps, f.focal_point_y_bps, f.scale_bps, f.background_color, ${input.userId}::uuid
      from inserted cross join scene_variant_framings f
      where f.workspace_id = ${input.workspaceId}::uuid and f.project_id = ${input.projectId}::uuid
        and f.scene_version_id = ${input.previousVersionId}::uuid and ${input.compatibility.image}
      returning id
    ), copied_captions as (
      update project_subtitle_settings settings set segment_text_overrides = settings.segment_text_overrides || coalesce((
        select jsonb_object_agg(inserted.id::text || substring(entry.key from 37), entry.value)
        from jsonb_each(settings.segment_text_overrides) entry
        where left(entry.key, 37) = ${input.previousVersionId + ":"}
      ), '{}'::jsonb), updated_at = now()
      from inserted where settings.workspace_id = ${input.workspaceId}::uuid and settings.project_id = ${input.projectId}::uuid and ${input.compatibility.audio}
      returning settings.id
    ) select id from inserted
  `);
  if (result.rows.length !== 1) throw new SceneRevisionConflictError();
  return { changed: true, versionId };
}
