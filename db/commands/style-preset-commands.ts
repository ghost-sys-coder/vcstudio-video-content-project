import "server-only";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  stylePresetVersions,
  stylePresets,
  type ProjectAspectRatio,
} from "@/db/schema";
import { createStylePresetSlug } from "@/lib/domain/style-preset";

export class StylePresetError extends Error {
  constructor(
    public readonly code:
      | "NOT_FOUND"
      | "SLUG_EXHAUSTED"
      | "CANNOT_ARCHIVE_DEFAULT"
      | "ALREADY_ARCHIVED",
    message: string,
  ) {
    super(message);
    this.name = "StylePresetError";
  }
}

/**
 * Creates a style and its first version together.
 *
 * The two rows are inserted in one batch because a preset with no version is
 * unusable but still appears in every listing: the repository inner-joins the
 * latest version, so a half-created preset would simply be invisible while
 * still holding its slug. Creating both at once removes that state entirely.
 */
export async function createStylePresetWithVersion(input: {
  workspaceId: string;
  userId: string;
  name: string;
  description: string;
  positivePrompt: string;
  negativePrompt: string;
  defaultAspectRatio: ProjectAspectRatio;
}) {
  const database = getDatabase();
  const baseSlug = createStylePresetSlug(input.name);

  // Two creators can legitimately want "Cinematic" twice, and copying the same
  // template twice is an ordinary thing to do. A numeric suffix is friendlier
  // than refusing, and the loop is bounded so a pathological case fails loudly
  // rather than spinning.
  //
  // A taken slug is discovered by the unique index rather than by asking
  // first, because asking first still races. The batch is one transaction, so
  // a collision aborts both inserts together and the retry starts from a clean
  // state; there is no window where a preset exists without its version.
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const stylePresetId = crypto.randomUUID();
    try {
      const [createdPresets] = await database.batch([
        database
          .insert(stylePresets)
          .values({
            id: stylePresetId,
            workspaceId: input.workspaceId,
            slug,
            isDefault: false,
            createdByUserId: input.userId,
          })
          .returning(),
        database.insert(stylePresetVersions).values({
          workspaceId: input.workspaceId,
          stylePresetId,
          version: 1,
          name: input.name,
          description: input.description,
          positivePrompt: input.positivePrompt,
          negativePrompt: input.negativePrompt,
          defaultAspectRatio: input.defaultAspectRatio,
          createdByUserId: input.userId,
        }),
      ]);
      const created = createdPresets[0];
      if (created) return created;
    } catch (error) {
      // The last attempt rethrows: a persistent failure here is a real fault,
      // not a busy slug, and swallowing it would report "too many styles".
      if (attempt === 24) throw error;
    }
  }

  throw new StylePresetError(
    "SLUG_EXHAUSTED",
    "Too many styles already share that name.",
  );
}

/**
 * Archives a style so it stops appearing in pickers.
 *
 * Never deletes. Generations, projects and format presets cite style versions
 * as history, and a workspace that removed a style would lose the record of
 * what its finished videos were actually made from.
 */
export async function archiveStylePreset(input: {
  workspaceId: string;
  stylePresetId: string;
}) {
  const [preset] = await getDatabase()
    .select()
    .from(stylePresets)
    .where(
      and(
        eq(stylePresets.workspaceId, input.workspaceId),
        eq(stylePresets.id, input.stylePresetId),
      ),
    )
    .limit(1);
  if (!preset) throw new StylePresetError("NOT_FOUND", "Style not found.");
  if (preset.archivedAt)
    throw new StylePresetError("ALREADY_ARCHIVED", "Style already archived.");
  // Archiving the default would leave the workspace with no default at all,
  // and image generation falls back to it. Make the caller choose a new
  // default first rather than silently breaking that fallback.
  if (preset.isDefault)
    throw new StylePresetError(
      "CANNOT_ARCHIVE_DEFAULT",
      "Make another style the default before archiving this one.",
    );

  const [archived] = await getDatabase()
    .update(stylePresets)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(stylePresets.workspaceId, input.workspaceId),
        eq(stylePresets.id, input.stylePresetId),
        isNull(stylePresets.archivedAt),
      ),
    )
    .returning();
  if (!archived)
    throw new StylePresetError("NOT_FOUND", "Style could not be archived.");
  return archived;
}

export async function restoreStylePreset(input: {
  workspaceId: string;
  stylePresetId: string;
}) {
  const [restored] = await getDatabase()
    .update(stylePresets)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(stylePresets.workspaceId, input.workspaceId),
        eq(stylePresets.id, input.stylePresetId),
      ),
    )
    .returning();
  if (!restored) throw new StylePresetError("NOT_FOUND", "Style not found.");
  return restored;
}

/**
 * Moves the workspace default onto another style.
 *
 * `style_presets_workspace_default_unique` permits exactly one unarchived
 * default per workspace, so the old default must be cleared before the new one
 * is set. The two writes go in one batch, which the driver runs as a single
 * transaction, so a failure cannot leave the workspace with none.
 */
export async function setDefaultStylePreset(input: {
  workspaceId: string;
  stylePresetId: string;
}) {
  const database = getDatabase();
  const [target] = await database
    .select()
    .from(stylePresets)
    .where(
      and(
        eq(stylePresets.workspaceId, input.workspaceId),
        eq(stylePresets.id, input.stylePresetId),
        isNull(stylePresets.archivedAt),
      ),
    )
    .limit(1);
  if (!target)
    throw new StylePresetError("NOT_FOUND", "That style is not available.");
  if (target.isDefault) return target;

  const [, updated] = await database.batch([
    database
      .update(stylePresets)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(
        and(
          eq(stylePresets.workspaceId, input.workspaceId),
          eq(stylePresets.isDefault, true),
          ne(stylePresets.id, input.stylePresetId),
        ),
      ),
    database
      .update(stylePresets)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(stylePresets.workspaceId, input.workspaceId),
          eq(stylePresets.id, input.stylePresetId),
          isNull(stylePresets.archivedAt),
        ),
      )
      .returning(),
  ]);

  const next = updated[0];
  if (!next)
    throw new StylePresetError("NOT_FOUND", "That style is not available.");
  return next;
}

/** The latest version of one style, used to resolve a project's chosen style. */
export async function findLatestStylePresetVersion(input: {
  workspaceId: string;
  stylePresetId: string;
}) {
  const [row] = await getDatabase()
    .select({ preset: stylePresets, version: stylePresetVersions })
    .from(stylePresets)
    .innerJoin(
      stylePresetVersions,
      and(
        eq(stylePresetVersions.workspaceId, input.workspaceId),
        eq(stylePresetVersions.stylePresetId, stylePresets.id),
      ),
    )
    .where(
      and(
        eq(stylePresets.workspaceId, input.workspaceId),
        eq(stylePresets.id, input.stylePresetId),
      ),
    )
    .orderBy(sql`${stylePresetVersions.version} desc`)
    .limit(1);
  return row ?? null;
}
