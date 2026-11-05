import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import type { VerifiedMediaMetadata } from "@/lib/media/media-inspection";
export async function saveGeneratedVideoAsset(input: {
  workspaceId: string;
  generationId: string;
  assetId: string;
  objectKey: string;
  sizeBytes: number;
  title: string;
  userId: string;
  metadata: Extract<VerifiedMediaMetadata, { kind: "video" }>;
  warnings: string[];
  actualCostCents: number | null;
}) {
  await getDatabase().execute(sql`
    with inserted as (
      insert into media_assets(id,workspace_id,kind,status,object_key,content_type,size_bytes,original_file_name,title,width,height,duration_milliseconds,inspection_status,verified_metadata,inspection_warnings,inspected_at,uploaded_by_user_id)
      select ${input.assetId}::uuid,${input.workspaceId}::uuid,'video','ready',${input.objectKey},'video/mp4',${input.sizeBytes},'generated-video.mp4',${input.title},${input.metadata.displayWidth},${input.metadata.displayHeight},${input.metadata.durationMilliseconds},'succeeded',${JSON.stringify(input.metadata)}::jsonb,${JSON.stringify(input.warnings)}::jsonb,now(),${input.userId}::uuid
      where exists(select 1 from video_generations where workspace_id=${input.workspaceId}::uuid and id=${input.generationId}::uuid and status in ('running','inspecting','requires_reconciliation'))
      on conflict(id) do nothing returning id
    )
    update video_generations set output_asset_id=${input.assetId}::uuid,status='succeeded',actual_cost_cents=${input.actualCostCents},encrypted_output=null,error_code=null,safe_error_message=${input.actualCostCents === null ? "Video ready. Provider cost is awaiting reconciliation; the estimate remains reserved." : null},completed_at=now(),updated_at=now()
    where workspace_id=${input.workspaceId}::uuid and id=${input.generationId}::uuid and status in ('running','inspecting','requires_reconciliation')
      and (exists(select 1 from inserted) or exists(select 1 from media_assets where id=${input.assetId}::uuid and workspace_id=${input.workspaceId}::uuid and object_key=${input.objectKey}))
  `);
}
