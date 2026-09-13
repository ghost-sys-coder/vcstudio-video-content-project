import "server-only";

import { createSceneAssetPrefix } from "@/lib/storage/object-key";
import { purgeObjectPrefix } from "@/lib/storage/purge-object-prefix";

/**
 * Refuses to keep paginating past this many pages of 1000 objects.
 *
 * A scene holds a handful of images, their reframed variants, one narration
 * take and at most one clip — tens of objects, not thousands. Reaching even the
 * second page means the prefix is not a single scene's, and the guard should
 * stop rather than delete whatever it finds.
 */
const MAX_PAGES = 5;

/**
 * Permanently deletes every stored object belonging to one scene.
 *
 * Deleting a scene cascades its rows away in the database, but rows are not
 * what R2 bills for: without this, the generated images, their reframed
 * variants, the narration audio and any clip stay in the bucket forever, with
 * nothing left in the application able to name them again.
 *
 * Scoped by the scene's own prefix, so it cannot reach a sibling scene's work
 * even if a caller passes the wrong identifiers — the prefix simply matches
 * nothing.
 */
export async function deleteSceneAssetObjects(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
}): Promise<{ deletedCount: number }> {
  return purgeObjectPrefix({
    prefix: createSceneAssetPrefix(input),
    maxPages: MAX_PAGES,
    subject: "this scene",
  });
}
