import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { voicePresets } from "@/db/schema";
import {
  DEFAULT_VOICE_PRESET,
  slugifyVoicePresetName,
} from "@/lib/domain/default-voice-preset";

type AudioFormat = typeof voicePresets.$inferInsert.format;

export async function ensureDefaultVoicePreset(input: {
  workspaceId: string;
  model: string;
  voice: string;
  format: AudioFormat;
  speedScaledPercent: number;
}): Promise<void> {
  await getDatabase().execute(sql`
    insert into voice_presets (
      id, workspace_id, name, slug, provider, model, voice, instructions,
      speed_scaled_percent, format, is_default, created_by_user_id
    )
    select
      gen_random_uuid(),
      w.id,
      ${DEFAULT_VOICE_PRESET.name},
      ${DEFAULT_VOICE_PRESET.slug},
      'openai',
      ${input.model},
      ${input.voice},
      ${DEFAULT_VOICE_PRESET.instructions},
      ${input.speedScaledPercent},
      ${input.format}::audio_output_format,
      true,
      w.created_by_user_id
    from workspaces w
    where w.id = ${input.workspaceId}
      and not exists (
        select 1 from voice_presets vp
        where vp.workspace_id = w.id
          and vp.is_default = true
          and vp.archived_at is null
      )
    on conflict (workspace_id, slug) do nothing
  `);
}

export async function createVoicePreset(input: {
  workspaceId: string;
  createdByUserId: string;
  name: string;
  voice: string;
  model: string;
  instructions: string;
  speedScaledPercent: number;
  format: AudioFormat;
  isDefault: boolean;
}) {
  const database = getDatabase();
  const baseSlug = slugifyVoicePresetName(input.name);

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const values = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      slug,
      provider: "openai",
      model: input.model,
      voice: input.voice,
      instructions: input.instructions,
      speedScaledPercent: input.speedScaledPercent,
      format: input.format,
      isDefault: input.isDefault,
      createdByUserId: input.createdByUserId,
    };
    try {
      if (input.isDefault) {
        const [, createdRows] = await database.batch([
          database
            .update(voicePresets)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(voicePresets.workspaceId, input.workspaceId),
                eq(voicePresets.isDefault, true),
              ),
            ),
          database.insert(voicePresets).values(values).returning(),
        ]);
        if (!createdRows[0]) throw new Error("VOICE_PRESET_CREATE_FAILED");
        return createdRows[0];
      }
      const [created] = await database
        .insert(voicePresets)
        .values(values)
        .returning();
      if (!created) throw new Error("VOICE_PRESET_CREATE_FAILED");
      return created;
    } catch (error) {
      const cause =
        typeof error === "object" && error !== null
          ? Reflect.get(error, "cause")
          : null;
      const constraint =
        (typeof error === "object" && error !== null
          ? Reflect.get(error, "constraint")
          : null) ??
        (typeof cause === "object" && cause !== null
          ? Reflect.get(cause, "constraint")
          : null);
      if (constraint === "voice_presets_workspace_slug_unique") continue;
      throw error;
    }
  }
  throw new Error("VOICE_PRESET_SLUG_CONFLICT");
}
