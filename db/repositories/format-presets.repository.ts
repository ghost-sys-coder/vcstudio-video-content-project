import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  formatPresetVersions,
  formatPresets,
  projects,
  type FormatPreset,
  type FormatPresetVersion,
} from "@/db/schema";

export type FormatPresetWithCurrentVersion = {
  preset: FormatPreset;
  /** Highest version number; the one a new project would inherit. */
  currentVersion: FormatPresetVersion | null;
};

export async function listFormatPresets(input: {
  workspaceId: string;
  includeArchived?: boolean;
}): Promise<FormatPresetWithCurrentVersion[]> {
  const presets = await getDatabase()
    .select()
    .from(formatPresets)
    .where(
      input.includeArchived
        ? eq(formatPresets.workspaceId, input.workspaceId)
        : and(
            eq(formatPresets.workspaceId, input.workspaceId),
            eq(formatPresets.status, "active"),
          ),
    )
    .orderBy(asc(formatPresets.name))
    .limit(200);
  if (presets.length === 0) return [];

  const versions = await getDatabase()
    .select()
    .from(formatPresetVersions)
    .where(eq(formatPresetVersions.workspaceId, input.workspaceId))
    .orderBy(desc(formatPresetVersions.versionNumber))
    .limit(2000);
  const currentByPreset = new Map<string, FormatPresetVersion>();
  for (const version of versions)
    if (!currentByPreset.has(version.formatPresetId))
      currentByPreset.set(version.formatPresetId, version);

  return presets.map((preset) => ({
    preset,
    currentVersion: currentByPreset.get(preset.id) ?? null,
  }));
}

/** The version a new project would inherit from this preset right now. */
export async function findCurrentFormatPresetVersion(input: {
  workspaceId: string;
  formatPresetId: string;
}): Promise<FormatPresetVersion | null> {
  const [version] = await getDatabase()
    .select()
    .from(formatPresetVersions)
    .where(
      and(
        eq(formatPresetVersions.workspaceId, input.workspaceId),
        eq(formatPresetVersions.formatPresetId, input.formatPresetId),
      ),
    )
    .orderBy(desc(formatPresetVersions.versionNumber))
    .limit(1);
  return version ?? null;
}

/** The exact version a project was created from, however old. */
export async function findFormatPresetVersion(input: {
  workspaceId: string;
  formatPresetVersionId: string;
}): Promise<FormatPresetVersion | null> {
  const [version] = await getDatabase()
    .select()
    .from(formatPresetVersions)
    .where(
      and(
        eq(formatPresetVersions.workspaceId, input.workspaceId),
        eq(formatPresetVersions.id, input.formatPresetVersionId),
      ),
    )
    .limit(1);
  return version ?? null;
}

/**
 * Projects already started from one saved idea.
 *
 * Surfaced so a repeat use is visible history rather than a silent block: a
 * creator may deliberately make a follow-up from the same idea, and the
 * interface should say "you have made two of these" instead of refusing.
 */
export async function listProjectsFromIdea(input: {
  workspaceId: string;
  contentIdeaId: string;
}) {
  return getDatabase()
    .select({
      id: projects.id,
      name: projects.name,
      status: projects.status,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, input.workspaceId),
        eq(projects.sourceContentIdeaId, input.contentIdeaId),
      ),
    )
    .orderBy(desc(projects.createdAt))
    .limit(50);
}
