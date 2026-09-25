import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import type { SceneContent } from "@/lib/schemas/scene";

export class ManualSceneCreationError extends Error {
  constructor() {
    super(
      "The scene could not be added. Refresh the plan or shorten its duration and try again.",
    );
  }
}

/**
 * Lock the project while numbering and inserting both rows. The first scene
 * needs no script or analysis run; later manual scenes join the currently
 * visible plan, including an AI plan if one already exists. A new completed AI
 * analysis retains the existing replacement semantics for the visible plan.
 */
export async function createManualScene(
  input: SceneContent & {
    workspaceId: string;
    projectId: string;
    userId: string;
  },
) {
  const sceneId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await getDatabase().execute<{ scene_number: number }>(sql`
    with locked_project as materialized (
      select id from projects
      where id = ${input.projectId}::uuid
        and workspace_id = ${input.workspaceId}::uuid
        and status <> 'archived'
        and not exists (
          select 1 from scene_analysis_runs r
          where r.project_id = projects.id
            and r.workspace_id = projects.workspace_id
            and r.status in ('pending', 'queued', 'running')
        )
      for update
    ), active_run as (
      select r.id, r.script_version_id from scene_analysis_runs r
      join locked_project p on p.id = r.project_id
      where r.workspace_id = ${input.workspaceId}::uuid
        and r.status = 'completed'
      order by r.completed_at desc limit 1
    ), numbered as (
      select coalesce(max(s.scene_number), 0) + 1 as scene_number,
        coalesce(sum(v.estimated_duration_milliseconds), 0) as start_time
      from locked_project p
      left join scenes s on s.project_id = p.id
        and s.workspace_id = ${input.workspaceId}::uuid
        and s.analysis_run_id is not distinct from (select id from active_run)
      left join scene_versions v on v.scene_id = s.id
        and v.version_number = s.current_version
    ), created as (
      insert into scenes (
        id, workspace_id, project_id, script_version_id,
        analysis_run_id, scene_number, status
      )
      select ${sceneId}::uuid, ${input.workspaceId}::uuid, p.id,
        (select script_version_id from active_run),
        (select id from active_run), n.scene_number, 'draft'
      from locked_project p cross join numbered n
      where n.scene_number < 1000000
        and n.start_time + ${input.estimatedDurationMilliseconds} < 2147483647
      on conflict do nothing
      returning id, scene_number
    ), version as (
      insert into scene_versions (
        id, workspace_id, project_id, scene_id, version_number,
        narration_text, visual_description, location_description,
        action_description, camera_shot, camera_angle, camera_motion,
        emotional_tone, character_names, prop_names, continuity_notes,
        estimated_duration_milliseconds, start_time_milliseconds,
        end_time_milliseconds, created_by_user_id
      )
      select ${versionId}::uuid, ${input.workspaceId}::uuid,
        ${input.projectId}::uuid, created.id, 1,
        ${input.narrationText}, ${input.visualDescription},
        ${input.locationDescription}, ${input.actionDescription},
        ${input.cameraShot}, ${input.cameraAngle}, ${input.cameraMotion},
        ${input.emotionalTone}, ${JSON.stringify(input.characterNames)}::jsonb,
        ${JSON.stringify(input.propNames)}::jsonb, ${input.continuityNotes},
        ${input.estimatedDurationMilliseconds}, n.start_time,
        n.start_time + ${input.estimatedDurationMilliseconds}, ${input.userId}::uuid
      from created cross join numbered n returning scene_id
    )
    select created.scene_number from created
    join version on version.scene_id = created.id
  `);
    const sceneNumber = result.rows[0]?.scene_number;
    if (sceneNumber) return { sceneId, sceneNumber: Number(sceneNumber) };
  }
  throw new ManualSceneCreationError();
}
