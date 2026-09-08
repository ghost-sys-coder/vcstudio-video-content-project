/** Legacy clips use absolute time. An earlier revision can shift that range. */
export function shortNeedsRangeReview(
  clips: {
    sourceSceneId: string;
    sourceSceneVersionId: string;
    createdAt: Date;
  }[],
  rows: {
    scene: { id: string; sceneNumber: number };
    version: { id: string; createdAt: Date };
  }[],
) {
  return clips.some((clip) => {
    const source = rows.find((row) => row.scene.id === clip.sourceSceneId);
    if (!source || source.version.id !== clip.sourceSceneVersionId) return true;
    return rows.some(
      (row) =>
        row.scene.sceneNumber < source.scene.sceneNumber &&
        row.version.createdAt.getTime() > clip.createdAt.getTime(),
    );
  });
}
