import "server-only";

import { createProjectAssetPrefix } from "@/lib/storage/object-key";
import { purgeObjectPrefix } from "@/lib/storage/purge-object-prefix";

/**
 * Refuses to keep paginating past this many pages. A real project is in the
 * hundreds of objects; anything beyond this means the prefix is not what we
 * think it is.
 */
const MAX_PAGES = 50;

/**
 * Permanently deletes every stored object belonging to a project.
 *
 * The listing and deletion mechanics live in `purgeObjectPrefix`, which a
 * single scene's deletion uses as well — the reasoning about partial failures
 * and unbounded prefixes is identical and is worth having in one place rather
 * than in two that can drift apart.
 */
export async function deleteProjectAssetObjects(input: {
  workspaceId: string;
  projectId: string;
}): Promise<{ deletedCount: number }> {
  return purgeObjectPrefix({
    prefix: createProjectAssetPrefix(input),
    maxPages: MAX_PAGES,
    subject: "this project",
  });
}
