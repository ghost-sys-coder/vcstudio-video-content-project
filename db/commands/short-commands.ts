import "server-only";

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
