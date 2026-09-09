import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { formatPresetVersions, formatPresets } from "@/db/schema";
import type { FormatPresetVersionInput } from "@/lib/schemas/format-preset";
import { createFormatPresetSlug } from "@/lib/schemas/format-preset";

export class FormatPresetNotFoundError extends Error {
  readonly code = "FORMAT_PRESET_NOT_FOUND";

  constructor() {
    super("This format is unavailable.");
    this.name = "FormatPresetNotFoundError";
  }
}

async function claimSlug(input: {
  workspaceId: string;
  name: string;
  excludeFormatPresetId?: string;
}): Promise<string> {
  const base = createFormatPresetSlug(input.name);
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const [existing] = await getDatabase()
      .select({ id: formatPresets.id })
      .from(formatPresets)
      .where(
        and(
          eq(formatPresets.workspaceId, input.workspaceId),
          eq(formatPresets.slug, candidate),
        ),
      )
      .limit(1);
    if (!existing || existing.id === input.excludeFormatPresetId)
      return candidate;
  }
  throw new FormatPresetNotFoundError();
}

/** Creates a format and its first immutable version in one write. */
export async function createFormatPreset(input: {
  workspaceId: string;
  createdByUserId: string;
  name: string;
  channelProfileId: string | null;
  values: FormatPresetVersionInput;
}) {
  const slug = await claimSlug({
    workspaceId: input.workspaceId,
    name: input.name,
  });
  const presetId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  await getDatabase().batch([
    getDatabase().insert(formatPresets).values({
      id: presetId,
      workspaceId: input.workspaceId,
      name: input.name,
      slug,
      channelProfileId: input.channelProfileId,
      createdByUserId: input.createdByUserId,
    }),
    getDatabase()
      .insert(formatPresetVersions)
      .values({
        id: versionId,
        workspaceId: input.workspaceId,
        formatPresetId: presetId,
        versionNumber: 1,
        createdByUserId: input.createdByUserId,
        ...input.values,
      }),
  ]);
  return { presetId, versionId, versionNumber: 1 };
}

/**
 * Publishes an edited format as a **new version**.
 *
 * Never updates an existing version row. Projects snapshot the version they
 * were created from, so appending is what stops an edit reaching back into
 * videos already in production. The version number is derived inside the same
 * statement as the insert, so two concurrent edits cannot claim the same one —
 * the unique index on (format_preset_id, version_number) rejects the loser.
 */
export async function publishFormatPresetVersion(input: {
  workspaceId: string;
  formatPresetId: string;
  createdByUserId: string;
  values: FormatPresetVersionInput;
}) {
  const [preset] = await getDatabase()
    .select({ id: formatPresets.id })
    .from(formatPresets)
    .where(
      and(
        eq(formatPresets.workspaceId, input.workspaceId),
        eq(formatPresets.id, input.formatPresetId),
        eq(formatPresets.status, "active"),
      ),
    )
    .limit(1);
  if (!preset) throw new FormatPresetNotFoundError();

  const [created] = await getDatabase()
    .insert(formatPresetVersions)
    .values({
      workspaceId: input.workspaceId,
      formatPresetId: input.formatPresetId,
      versionNumber: sql`(
        select coalesce(max(${formatPresetVersions.versionNumber}), 0) + 1
        from ${formatPresetVersions}
        where ${formatPresetVersions.formatPresetId} = ${input.formatPresetId}
      )`,
      createdByUserId: input.createdByUserId,
      ...input.values,
    })
    .returning();
  if (!created) throw new FormatPresetNotFoundError();
  await getDatabase()
    .update(formatPresets)
    .set({ updatedAt: new Date() })
    .where(eq(formatPresets.id, input.formatPresetId));
  return created;
}

/**
 * Archives a format. Never deletes: existing versions are cited by projects as
 * historical evidence of how those videos were configured.
 */
export async function archiveFormatPreset(input: {
  workspaceId: string;
  formatPresetId: string;
}) {
  const now = new Date();
  const [archived] = await getDatabase()
    .update(formatPresets)
    .set({ status: "archived", archivedAt: now, updatedAt: now })
    .where(
      and(
        eq(formatPresets.workspaceId, input.workspaceId),
        eq(formatPresets.id, input.formatPresetId),
        eq(formatPresets.status, "active"),
      ),
    )
    .returning();
  if (!archived) throw new FormatPresetNotFoundError();
  return archived;
}
