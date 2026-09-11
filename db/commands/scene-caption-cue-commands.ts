import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import type { CaptionCue } from "@/lib/subtitles/cue-editing";

export class CaptionCueConflictError extends Error {
  constructor() {
    super("CAPTION_CUE_REVISION_CONFLICT");
    this.name = "CaptionCueConflictError";
  }
}

/**
 * Saves a whole corrected cue list for one scene's narration.
 *
 * **One statement, and it verifies the whole chain.** The scene version must
 * belong to this project and workspace, and the audio generation must belong to
 * that same scene version, both checked in the `where` clause rather than
 * before it. A caller that supplies an audio id from another scene gets no row
 * written and a `false` back, instead of a correction silently attached to the
 * wrong narration.
 *
 * **The write is whole-list and optimistically locked.** Splitting a cue
 * changes how many there are, so there is no sensible per-cue merge; two tabs
 * editing the same scene must conflict rather than have one quietly discard the
 * other's split. `expectedRevision` is the revision the editor was shown.
 */
export async function saveSceneCaptionCues(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  audioGenerationId: string;
  cues: CaptionCue[];
  expectedRevision: number | null;
  userId: string;
}): Promise<{ revision: number }> {
  const payload = JSON.stringify(input.cues);
  const result = await getDatabase().execute<{ revision: number }>(sql`
    insert into scene_caption_cues
      (workspace_id, project_id, scene_id, scene_version_id, audio_generation_id,
       cues, revision, updated_by_user_id)
    select ${input.workspaceId}::uuid, v.project_id, v.scene_id, v.id, a.id,
      ${payload}::jsonb, 1, ${input.userId}::uuid
    from scene_versions v
    join scene_audio_generations a
      on a.scene_version_id = v.id and a.workspace_id = v.workspace_id
    where v.id = ${input.sceneVersionId}::uuid
      and v.workspace_id = ${input.workspaceId}::uuid
      and v.project_id = ${input.projectId}::uuid
      and a.id = ${input.audioGenerationId}::uuid
      and ${input.expectedRevision ?? null}::integer is null
    on conflict (scene_version_id, audio_generation_id) do nothing
    returning revision
  `);
  if (result.rows[0]) return result.rows[0];

  if (input.expectedRevision === null) throw new CaptionCueConflictError();
  const updated = await getDatabase().execute<{ revision: number }>(sql`
    update scene_caption_cues
    set cues = ${payload}::jsonb,
      revision = revision + 1,
      updated_by_user_id = ${input.userId}::uuid,
      updated_at = now()
    where workspace_id = ${input.workspaceId}::uuid
      and project_id = ${input.projectId}::uuid
      and scene_version_id = ${input.sceneVersionId}::uuid
      and audio_generation_id = ${input.audioGenerationId}::uuid
      and revision = ${input.expectedRevision}
    returning revision
  `);
  const row = updated.rows[0];
  if (!row) throw new CaptionCueConflictError();
  return row;
}

/**
 * Discards a scene's corrections so it returns to derived timing.
 *
 * A real delete rather than an empty list, because "no corrections" and "a
 * correction that happens to be empty" must not be the same state; the table's
 * own check constraint refuses the latter.
 */
export async function clearSceneCaptionCues(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  audioGenerationId: string;
}): Promise<boolean> {
  const result = await getDatabase().execute<{ id: string }>(sql`
    delete from scene_caption_cues
    where workspace_id = ${input.workspaceId}::uuid
      and project_id = ${input.projectId}::uuid
      and scene_version_id = ${input.sceneVersionId}::uuid
      and audio_generation_id = ${input.audioGenerationId}::uuid
    returning id
  `);
  return result.rows.length > 0;
}
