import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { VideoOperationError } from "./video-generation-commands";
import type { SceneVisualSelection } from "@/db/schema";
export async function appendSceneVisualSelection(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  expectedSceneVersion: number;
  expectedRevision: number;
  userId: string;
  selection: Pick<
    SceneVisualSelection,
    | "id"
    | "kind"
    | "sourceAssetId"
    | "objectKey"
    | "width"
    | "height"
    | "durationMilliseconds"
    | "fit"
    | "trimStartMilliseconds"
    | "loop"
    | "reviewStatus"
  >;
}) {
  const value = input.selection;
  const result = await getDatabase().execute<{ id: string }>(sql`
    insert into scene_visual_selections(id,workspace_id,project_id,scene_id,scene_version_id,kind,source_asset_id,object_key,width,height,duration_milliseconds,fit,trim_start_milliseconds,loop,review_status,revision,updated_by_user_id)
    select ${value.id}::uuid,${input.workspaceId}::uuid,${input.projectId}::uuid,${input.sceneId}::uuid,${input.sceneVersionId}::uuid,${value.kind},${value.sourceAssetId}::uuid,${value.objectKey},${value.width},${value.height},${value.durationMilliseconds},${value.fit},${value.trimStartMilliseconds},${value.loop},${value.reviewStatus},${input.expectedRevision + 1},${input.userId}::uuid
    where exists(select 1 from scenes s join scene_versions sv on sv.scene_id=s.id and sv.version_number=s.current_version and sv.workspace_id=s.workspace_id and sv.project_id=s.project_id where s.id=${input.sceneId}::uuid and s.project_id=${input.projectId}::uuid and s.workspace_id=${input.workspaceId}::uuid and s.current_version=${input.expectedSceneVersion} and sv.id=${input.sceneVersionId}::uuid)
    and coalesce((select max(revision) from scene_visual_selections where scene_version_id=${input.sceneVersionId}::uuid and workspace_id=${input.workspaceId}::uuid),0)=${input.expectedRevision}
    on conflict(scene_version_id,workspace_id,revision) do nothing returning id
  `);
  if (!result.rows[0])
    throw new VideoOperationError(
      "scene_changed",
      "This scene or its media changed. Refresh before saving again.",
    );
  return value.id;
}
