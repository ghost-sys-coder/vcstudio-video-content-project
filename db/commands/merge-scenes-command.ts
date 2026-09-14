import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase, getNeonClient } from "@/db/drizzle";
import { scenes, sceneVersions } from "@/db/schema";
import { PARKING_OFFSET } from "@/db/commands/scene-delete-commands";
import type { SceneMergePlan } from "@/lib/scenes/plan-scene-merge";

/**
 * Merges one scene into its neighbour: a new version of the survivor, the
 * absorbed scene gone, and the numbering closed up — all or nothing.
 *
 * **Atomicity is the only genuinely new problem here.** Every other part of a
 * merge already existed: `saveSceneRevision` writes a version, and
 * `deleteSceneAndRenumber` removes a scene and closes the gap. Run one after
 * the other, a failure between them leaves a scene carrying both passages while
 * its partner still exists — the script narrated twice, which is precisely the
 * corruption the coverage checker exists to catch and which nothing would
 * repair automatically. So the three statements go as one transaction.
 *
 * **The later statements are self-guarding rather than trusting the earlier
 * one.** A statement that matches no rows does not raise, so a lost optimistic
 * claim would otherwise fall through to a delete that still happens. Both the
 * delete and the renumber are therefore conditioned on the new version row
 * existing, which it does only if the claim was won. Nothing is deleted when
 * nothing was merged, and the caller detects the no-op afterwards.
 *
 * **The survivor's visual brief is copied byte for byte from its own previous
 * version**, read inside the statement rather than passed in. That is what
 * keeps its approved images valid: `sceneMediaCompatibility` invalidates images
 * only when a visual field changes, and a value that never leaves the database
 * cannot drift on the way. Narration necessarily changes, so its audio is not
 * carried forward.
 */

export class SceneMergeConflictError extends Error {
  readonly code = "SCENE_MERGE_CONFLICT";
  constructor() {
    super("SCENE_MERGE_CONFLICT");
    this.name = "SceneMergeConflictError";
  }
}

export interface SceneMergeCommandResult {
  /** The merged scene's new version identifier. */
  versionId: string;
  resultingSceneNumber: number;
  remainingSceneCount: number;
}

export async function mergeScenesAndRenumber(input: {
  workspaceId: string;
  projectId: string;
  /** The survivor's current version row, whose brief the merge preserves. */
  previousVersionId: string;
  plan: SceneMergePlan;
  userId: string;
}): Promise<SceneMergeCommandResult> {
  const { plan } = input;
  const versionId = crypto.randomUUID();
  const endTimeMilliseconds =
    plan.startTimeMilliseconds + plan.mergedDurationMilliseconds;
  const client = getNeonClient();

  await client.transaction([
    // 1. Claim the survivor, prove the absorbed scene is still its neighbour in
    //    the same analysis run, and write the merged version.
    client`
      with claimed as (
        update scenes s
        set current_version = s.current_version + 1,
            status = 'review',
            updated_at = now()
        where s.id = ${plan.survivor.sceneId}
          and s.workspace_id = ${input.workspaceId}
          and s.project_id = ${input.projectId}
          and s.current_version = ${plan.survivor.currentVersion}
          and exists (
            select 1 from scenes a
            where a.id = ${plan.absorbed.sceneId}
              and a.workspace_id = ${input.workspaceId}
              and a.project_id = ${input.projectId}
              and a.current_version = ${plan.absorbed.currentVersion}
              and a.analysis_run_id = s.analysis_run_id
              and abs(a.scene_number - s.scene_number) = 1
          )
        returning s.id, s.current_version
      ), previous as (
        select * from scene_versions
        where id = ${input.previousVersionId}
          and workspace_id = ${input.workspaceId}
          and project_id = ${input.projectId}
      ), inserted as (
        insert into scene_versions (
          id, workspace_id, project_id, scene_id, version_number,
          narration_text, visual_description, location_description, action_description,
          camera_shot, camera_angle, camera_motion, emotional_tone,
          character_names, prop_names, continuity_notes, estimated_duration_milliseconds,
          start_time_milliseconds, end_time_milliseconds, created_by_user_id
        )
        select ${versionId}::uuid, ${input.workspaceId}::uuid, ${input.projectId}::uuid,
          claimed.id, claimed.current_version,
          ${plan.mergedNarrationText},
          previous.visual_description, previous.location_description, previous.action_description,
          previous.camera_shot, previous.camera_angle, previous.camera_motion, previous.emotional_tone,
          previous.character_names, previous.prop_names, previous.continuity_notes,
          ${plan.mergedDurationMilliseconds},
          ${plan.startTimeMilliseconds}, ${endTimeMilliseconds}, ${input.userId}::uuid
        from claimed join previous on previous.scene_id = claimed.id
        returning id
      ), copied_cast as (
        insert into scene_version_characters (
          workspace_id, project_id, scene_version_id, character_id,
          stage_slot, is_speaker, assigned_by_user_id
        )
        select ${input.workspaceId}::uuid, ${input.projectId}::uuid, inserted.id,
          cast_row.character_id, cast_row.stage_slot, cast_row.is_speaker, ${input.userId}::uuid
        from inserted cross join scene_version_characters cast_row
        where cast_row.workspace_id = ${input.workspaceId}::uuid
          and cast_row.project_id = ${input.projectId}::uuid
          and cast_row.scene_version_id = ${input.previousVersionId}::uuid
        returning id
      ), image_candidates as (
        select g.id, g.size, g.shot_index, 0 as priority from scene_image_generations g
        where g.workspace_id = ${input.workspaceId}::uuid and g.project_id = ${input.projectId}::uuid
          and g.scene_version_id = ${input.previousVersionId}::uuid
          and g.purpose = 'scene' and g.status = 'succeeded'
          and g.review_status = 'approved' and g.asset_object_key is not null
        union all
        select g.id, g.size, g.shot_index, 1 from scene_revision_media b
        join scene_image_generations g on g.id = b.image_generation_id
        where b.workspace_id = ${input.workspaceId}::uuid and b.project_id = ${input.projectId}::uuid
          and b.scene_version_id = ${input.previousVersionId}::uuid
          and g.workspace_id = b.workspace_id and g.project_id = b.project_id
          -- Same scene only. A pointer reaching into the absorbed scene would
          -- survive this statement and then lose its bytes to the storage purge,
          -- which sweeps by scene prefix.
          and g.scene_id = b.scene_id
          and g.purpose = 'scene' and g.status = 'succeeded'
          and g.review_status = 'approved' and g.asset_object_key is not null
      ), reused_images as (
        insert into scene_revision_media (
          workspace_id, project_id, scene_id, scene_version_id, slot, shot_index,
          image_generation_id, created_by_user_id
        )
        select ${input.workspaceId}::uuid, ${input.projectId}::uuid,
          ${plan.survivor.sceneId}::uuid, inserted.id, candidate.size,
          candidate.shot_index, candidate.id, ${input.userId}::uuid
        -- Every shot, not just the first at each size.
        from inserted cross join (
          select distinct on (size, shot_index) id, size, shot_index
          from image_candidates order by size, shot_index, priority
        ) candidate
        returning id
      ), copied_framing as (
        insert into scene_variant_framings (
          workspace_id, project_id, output_variant_id, scene_id, scene_version_id,
          source_image_generation_id, mode, focal_point_x_bps, focal_point_y_bps,
          scale_bps, background_color, updated_by_user_id
        )
        select f.workspace_id, f.project_id, f.output_variant_id, f.scene_id, inserted.id,
          f.source_image_generation_id, f.mode, f.focal_point_x_bps, f.focal_point_y_bps,
          f.scale_bps, f.background_color, ${input.userId}::uuid
        from inserted cross join scene_variant_framings f
        where f.workspace_id = ${input.workspaceId}::uuid
          and f.project_id = ${input.projectId}::uuid
          and f.scene_version_id = ${input.previousVersionId}::uuid
        returning id
      ) select id from inserted
    `,
    // 2. Remove the absorbed scene and park everything after it, but only if
    //    the merged version above actually landed.
    client`
      with removed as (
        delete from scenes
        where workspace_id = ${input.workspaceId}
          and project_id = ${input.projectId}
          and id = ${plan.absorbed.sceneId}
          and exists (
            select 1 from scene_versions
            where id = ${versionId}
              and workspace_id = ${input.workspaceId}
              and project_id = ${input.projectId}
          )
        returning scene_number
      )
      update scenes s
      set scene_number = s.scene_number + ${PARKING_OFFSET},
          updated_at = now()
      from removed r
      where s.workspace_id = ${input.workspaceId}
        and s.project_id = ${input.projectId}
        and s.scene_number > r.scene_number
    `,
    // 3. Bring them back one lower, into the gap the deletion just made.
    client`
      update scenes
      set scene_number = scene_number - ${PARKING_OFFSET} - 1,
          updated_at = now()
      where workspace_id = ${input.workspaceId}
        and project_id = ${input.projectId}
        and scene_number > ${PARKING_OFFSET}
    `,
  ]);

  // The transaction commits even when the claim matched nothing, because a
  // statement affecting no rows does not raise. Absence of the new version is
  // how that no-op is detected, and it means nothing at all was changed.
  const [created] = await getDatabase()
    .select({ id: sceneVersions.id })
    .from(sceneVersions)
    .where(
      and(
        eq(sceneVersions.id, versionId),
        eq(sceneVersions.workspaceId, input.workspaceId),
        eq(sceneVersions.projectId, input.projectId),
      ),
    )
    .limit(1);
  if (!created) throw new SceneMergeConflictError();

  const [remaining] = await getDatabase()
    .select({ count: sql<number>`count(*)::int` })
    .from(scenes)
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
      ),
    );

  return {
    versionId,
    resultingSceneNumber: plan.resultingSceneNumber,
    remainingSceneCount: Number(remaining?.count ?? 0),
  };
}
