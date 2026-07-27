import "server-only";

import { and, eq, max } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  stylePresetVersions,
  stylePresets,
  type ProjectAspectRatio,
} from "@/db/schema";
import { createStylePresetSlug } from "@/lib/domain/style-preset";

export async function createStylePreset(input: {
  workspaceId: string;
  name: string;
  createdByUserId: string;
}) {
  const slug = createStylePresetSlug(input.name);
  const [created] = await getDatabase()
    .insert(stylePresets)
    .values({
      workspaceId: input.workspaceId,
      slug,
      isDefault: false,
      createdByUserId: input.createdByUserId,
    })
    .onConflictDoNothing({
      target: [stylePresets.workspaceId, stylePresets.slug],
    })
    .returning();
  if (!created) throw new Error("STYLE_PRESET_SLUG_EXISTS");
  return created;
}

export async function createStylePresetVersion(input: {
  workspaceId: string;
  stylePresetId: string;
  name: string;
  description: string;
  positivePrompt: string;
  negativePrompt: string;
  defaultAspectRatio: ProjectAspectRatio;
  createdByUserId: string;
}) {
  const database = getDatabase();
  const [existing] = await database
    .select({ value: max(stylePresetVersions.version) })
    .from(stylePresetVersions)
    .where(
      and(
        eq(stylePresetVersions.workspaceId, input.workspaceId),
        eq(stylePresetVersions.stylePresetId, input.stylePresetId),
      ),
    );
  const version = (existing?.value ?? 0) + 1;

  const [created] = await database
    .insert(stylePresetVersions)
    .values({
      workspaceId: input.workspaceId,
      stylePresetId: input.stylePresetId,
      version,
      name: input.name,
      description: input.description,
      positivePrompt: input.positivePrompt,
      negativePrompt: input.negativePrompt,
      defaultAspectRatio: input.defaultAspectRatio,
      createdByUserId: input.createdByUserId,
    })
    .returning();
  if (!created) throw new Error("STYLE_PRESET_VERSION_CREATE_FAILED");
  return created;
}
