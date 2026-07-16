export function assertSceneImageReferenceSelection(input: {
  selectedReferenceAssetIds: readonly string[];
  eligibleReferenceAssetIds: readonly string[];
}): string[] {
  const selected = [...input.selectedReferenceAssetIds].sort();
  if (new Set(selected).size !== selected.length)
    throw new Error("DUPLICATE_SCENE_IMAGE_REFERENCE");

  const eligible = new Set(input.eligibleReferenceAssetIds);
  if (
    eligible.size !== selected.length ||
    selected.some((referenceAssetId) => !eligible.has(referenceAssetId))
  )
    throw new Error("SCENE_IMAGE_REFERENCE_NOT_ELIGIBLE");

  return selected;
}
