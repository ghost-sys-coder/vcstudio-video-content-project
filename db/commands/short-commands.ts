import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { shortClips, shortCompositions } from "@/db/schema";
import type { ShortClipDefinition } from "@/lib/shorts/short-timeline";

export async function createShortComposition(input: {
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
  name: string;
  createdByUserId: string;
  clips: ShortClipDefinition[];
}) {
  const shortCompositionId = crypto.randomUUID();
  const [created] = await getDatabase().batch([
    getDatabase()
      .insert(shortCompositions)
      .values({
        id: shortCompositionId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        outputVariantId: input.outputVariantId,
        name: input.name,
        createdByUserId: input.createdByUserId,
      })
      .returning(),
    getDatabase()
      .insert(shortClips)
      .values(
        input.clips.map((clip) => ({
          id: clip.id,
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          shortCompositionId,
          sourceSceneId: clip.sourceSceneId,
          sourceSceneVersionId: clip.sourceSceneVersionId,
          position: clip.position,
          sourceStartMilliseconds: clip.sourceStartMilliseconds,
          sourceEndMilliseconds: clip.sourceEndMilliseconds,
          transition: clip.transition,
        })),
      ),
  ]);
  const composition = created[0];
  if (!composition) throw new Error("SHORT_COMPOSITION_NOT_CREATED");
  return composition;
}

/**
 * Replaces a saved short's clip list wholesale. Renders read a short's
 * clips live at render time (`findShortCompositionWithClips`), so this is
 * always safe to call — it only affects renders started after this update.
 *
 * Existence/ownership is checked before the batch runs, not via the
 * update's `.returning()` result — `.batch()` runs every statement
 * regardless of whether an earlier one matched any rows, so a delete+insert
 * against an id from another workspace would otherwise still execute.
 */
export async function updateShortComposition(input: {
  workspaceId: string;
  projectId: string;
  shortCompositionId: string;
  name: string;
  clips: ShortClipDefinition[];
}) {
  const [existing] = await getDatabase()
    .select({ id: shortCompositions.id })
    .from(shortCompositions)
    .where(
      and(
        eq(shortCompositions.id, input.shortCompositionId),
        eq(shortCompositions.workspaceId, input.workspaceId),
        eq(shortCompositions.projectId, input.projectId),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("SHORT_COMPOSITION_NOT_FOUND");

  const [updated] = await getDatabase().batch([
    getDatabase()
      .update(shortCompositions)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(shortCompositions.id, input.shortCompositionId))
      .returning(),
    getDatabase()
      .delete(shortClips)
      .where(eq(shortClips.shortCompositionId, input.shortCompositionId)),
    getDatabase()
      .insert(shortClips)
      .values(
        input.clips.map((clip) => ({
          id: clip.id,
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          shortCompositionId: input.shortCompositionId,
          sourceSceneId: clip.sourceSceneId,
          sourceSceneVersionId: clip.sourceSceneVersionId,
          position: clip.position,
          sourceStartMilliseconds: clip.sourceStartMilliseconds,
          sourceEndMilliseconds: clip.sourceEndMilliseconds,
          transition: clip.transition,
        })),
      ),
  ]);
  const composition = updated[0];
  if (!composition) throw new Error("SHORT_COMPOSITION_NOT_FOUND");
  return composition;
}
