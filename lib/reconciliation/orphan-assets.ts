/**
 * Pure selection of orphan-asset candidates from generation/render rows.
 *
 * Two classes of inconsistency are flagged for a bounded, audited cleanup:
 * - `leakedAssets`: terminal-failed or cancelled rows that still reference a
 *   stored object (the object should be removed from R2).
 * - `missingAssets`: rows marked succeeded but with no stored object (a broken
 *   record that should be re-reconciled or flagged).
 *
 * Selection is non-destructive; callers decide how to act on the candidates.
 */

export type AssetRowSnapshot = {
  id: string;
  status: string;
  hasAsset: boolean;
};

export type OrphanAssetSelection = {
  leakedAssets: string[];
  missingAssets: string[];
};

const TERMINAL_WITHOUT_ASSET: ReadonlySet<string> = new Set([
  "failed",
  "cancelled",
]);

export function selectOrphanAssetCandidates(
  rows: AssetRowSnapshot[],
): OrphanAssetSelection {
  const leakedAssets: string[] = [];
  const missingAssets: string[] = [];
  for (const row of rows) {
    if (TERMINAL_WITHOUT_ASSET.has(row.status) && row.hasAsset)
      leakedAssets.push(row.id);
    else if (row.status === "succeeded" && !row.hasAsset)
      missingAssets.push(row.id);
  }
  return { leakedAssets, missingAssets };
}
