import type { Scene, SceneStatus, SceneVersion } from "@/db/schema";

export type SceneNavigationRow = {
  scene: Scene;
  version: SceneVersion;
};

export type SceneStatusFilter = "all" | SceneStatus;

export function findInitialSceneId(
  rows: SceneNavigationRow[],
  sceneNumber: number | null,
): string | null {
  if (!rows.length) return null;

  return (
    rows.find((row) => row.scene.sceneNumber === sceneNumber)?.scene.id ??
    rows[0].scene.id
  );
}

export function filterSceneRows(
  rows: SceneNavigationRow[],
  query: string,
  status: SceneStatusFilter,
): SceneNavigationRow[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return rows.filter(({ scene, version }) => {
    if (status !== "all" && scene.status !== status) return false;
    if (!normalizedQuery) return true;

    return [
      String(scene.sceneNumber),
      version.narrationText,
      version.visualDescription,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function getAdjacentSceneId(
  rows: SceneNavigationRow[],
  selectedSceneId: string | null,
  direction: "previous" | "next",
): string | null {
  const index = rows.findIndex((row) => row.scene.id === selectedSceneId);
  if (index < 0) return null;

  const adjacentIndex = direction === "previous" ? index - 1 : index + 1;
  return rows[adjacentIndex]?.scene.id ?? null;
}
