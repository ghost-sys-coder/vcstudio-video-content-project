import "server-only";
import { findCurrentScene } from "@/db/repositories/scenes.repository";

export async function assertCurrentMediaReview(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
}) {
  const row = await findCurrentScene(input);
  if (!row || row.version.id !== input.sceneVersionId)
    throw new Error("MEDIA_REVIEW_REQUIRES_CURRENT_SCENE_VERSION");
}
