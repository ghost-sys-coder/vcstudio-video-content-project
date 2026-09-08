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
    ) select id from inserted
  `);
  if (result.rows.length !== 1) throw new SceneRevisionConflictError();
  return { changed: true, versionId };
}
