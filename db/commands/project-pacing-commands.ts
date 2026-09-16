import "server-only";

import { and, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { projects } from "@/db/schema";
import type { PacingProfileId } from "@/lib/pacing/pacing-profile";

/**
 * Changes only the project's pacing profile.
 *
 * Deliberately not folded into `updateProject`, which writes the whole settings
 * form: pacing is chosen from the render workspace while somebody is watching a
 * preview, and routing that through a command that also sets the aspect ratio,
 * the budget and the status would let a stale form field travel with it.
 *
 * No optimistic lock. Two people choosing a pace a second apart is a
 * disagreement about taste that the last click settles, and nothing is
 * destroyed either way — the value only shapes the *next* render, since every
 * render already frozen keeps its own motion and transitions.
 */
export async function updateProjectPacingProfile(input: {
  workspaceId: string;
  projectId: string;
  pacingProfile: PacingProfileId;
}): Promise<{ updated: boolean }> {
  const [project] = await getDatabase()
    .update(projects)
    .set({ pacingProfile: input.pacingProfile, updatedAt: new Date() })
    .where(
      and(
        eq(projects.workspaceId, input.workspaceId),
        eq(projects.id, input.projectId),
      ),
    )
    .returning({ id: projects.id });
  return { updated: Boolean(project) };
}
