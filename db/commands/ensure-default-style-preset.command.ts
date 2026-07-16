import "server-only";

import { sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { DEFAULT_STYLE_PRESET } from "@/lib/domain/default-style-preset";

export async function ensureDefaultStylePreset(
  workspaceId: string,
): Promise<void> {
  await getDatabase().execute(sql`
    with target_workspace as materialized (
      select id, created_by_user_id
      from workspaces
      where id = ${workspaceId}
      limit 1
    ),
    inserted_preset as (
      insert into style_presets (
        id, workspace_id, slug, is_default, created_by_user_id
      )
      select
        gen_random_uuid(),
        target_workspace.id,
        ${DEFAULT_STYLE_PRESET.slug},
        true,
        target_workspace.created_by_user_id
      from target_workspace
      on conflict (workspace_id, slug) do nothing
      returning id, workspace_id, created_by_user_id
    ),
    target_preset as materialized (
      select id, workspace_id, created_by_user_id
      from inserted_preset
      union all
      select preset.id, preset.workspace_id, preset.created_by_user_id
      from style_presets preset
      inner join target_workspace
        on target_workspace.id = preset.workspace_id
      where preset.slug = ${DEFAULT_STYLE_PRESET.slug}
      limit 1
    )
    insert into style_preset_versions (
      workspace_id,
      style_preset_id,
      version,
      name,
      description,
      positive_prompt,
      negative_prompt,
      default_aspect_ratio,
      created_by_user_id
    )
    select
      target_preset.workspace_id,
      target_preset.id,
      ${DEFAULT_STYLE_PRESET.version},
      ${DEFAULT_STYLE_PRESET.name},
      ${DEFAULT_STYLE_PRESET.description},
      ${DEFAULT_STYLE_PRESET.positivePrompt},
      ${DEFAULT_STYLE_PRESET.negativePrompt},
      ${DEFAULT_STYLE_PRESET.defaultAspectRatio}::project_aspect_ratio,
      target_preset.created_by_user_id
    from target_preset
    on conflict (style_preset_id, version) do nothing
  `);
}
