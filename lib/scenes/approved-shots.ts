/**
 * Groups approved scene images by scene version, now that there can be more
 * than one.
 *
 * Before multi-image scenes, `listApprovedSceneImageAssets` returned at most
 * one row per scene version, so callers built a map straight from the array.
 * That is no longer safe: a scene holding three shots yields three rows, and
 * `new Map(rows.map(...))` silently keeps whichever arrived last. These two
 * helpers exist so the choice is stated rather than left to row order.
 *
 * "Primary" means the lowest shot index, which is shot 0 for every scene ever
 * created. It is the image that represents the scene wherever one image has to
 * stand for it: the storyboard thumbnail, readiness checks, and any render
 * path that does not itself understand shots.
 */

type ShotRow = {
  sceneVersionId: string;
  shotIndex: number;
};

/**
 * The image standing for each scene. Deliberately not "the first row": a
 * caller that has not sorted, or a query whose order changes, would otherwise
 * pick a different image and a render would stop reproducing.
 */
export function primaryImageBySceneVersion<Row extends ShotRow>(
  rows: readonly Row[],
): Map<string, Row> {
  const byVersion = new Map<string, Row>();
  for (const row of rows) {
    const existing = byVersion.get(row.sceneVersionId);
    if (!existing || row.shotIndex < existing.shotIndex)
      byVersion.set(row.sceneVersionId, row);
  }
  return byVersion;
}

/**
 * Every approved image for each scene version, in shot order.
 *
 * Duplicate shot indexes cannot occur for one size — the partial unique index
 * forbids them — but this is fed rows from more than one size in some callers,
 * so ties fall back to a stable order rather than an arbitrary one.
 */
export function shotsBySceneVersion<Row extends ShotRow>(
  rows: readonly Row[],
): Map<string, Row[]> {
  const byVersion = new Map<string, Row[]>();
  for (const row of rows) {
    const list = byVersion.get(row.sceneVersionId);
    if (list) list.push(row);
    else byVersion.set(row.sceneVersionId, [row]);
  }
  for (const list of byVersion.values())
    list.sort((left, right) => left.shotIndex - right.shotIndex);
  return byVersion;
}
