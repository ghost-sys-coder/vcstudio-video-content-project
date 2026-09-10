"use client";

import { useMemo } from "react";
import type {
  Character,
  ProjectVideoKind,
  Scene,
  SceneVersion,
} from "@/db/schema";
import type { SceneImageIndicator } from "@/lib/scenes/scene-image-indicator";
import type { SceneCharacterStaging } from "@/lib/scenes/scene-character-staging";
import { SceneCard } from "@/components/scenes/SceneCard";
import { SceneNavigator } from "@/components/scenes/SceneNavigator";
import { SceneWorkspaceHeader } from "@/components/scenes/SceneWorkspaceHeader";
import {
  filterSceneRows,
  getAdjacentSceneId,
  type SceneStatusFilter,
} from "@/lib/scenes/scene-navigation";

/**
 * The scene detail view: the navigator beside one scene's editor.
 *
 * Selection, filters and the unsaved-work guard are owned by the surrounding
 * workspace, because they have to outlive a change of view. This component only
 * draws the state it is given and reports what the creator did with it.
 */
export function SceneList({
  rows,
  canEdit,
  availableCharacters,
  canGenerateImages,
  canReviewImages,
  videoKind,
  selectedSceneId,
  query,
  status,
  onQueryChange,
  onStatusChange,
  onSelect,
  onDirtyChange,
}: {
  rows: Array<{
    scene: Scene;
    version: SceneVersion;
    assignedCharacters: Character[];
    characterStaging: SceneCharacterStaging[];
    imageIndicator: SceneImageIndicator;
  }>;
  canEdit: boolean;
  availableCharacters: Character[];
  canGenerateImages: boolean;
  canReviewImages: boolean;
  videoKind: ProjectVideoKind;
  selectedSceneId: string | null;
  query: string;
  status: SceneStatusFilter;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: SceneStatusFilter) => void;
  onSelect: (sceneId: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const selectedRow =
    rows.find((row) => row.scene.id === selectedSceneId) ?? rows[0] ?? null;
  const filteredRows = useMemo(
    () => filterSceneRows(rows, query, status),
    [query, rows, status],
  );
  const approvedCount = rows.filter(
    (row) => row.scene.status === "approved",
  ).length;

  if (!selectedRow)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <h2 className="font-semibold">No scenes yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Approve a script version, review the cost, and start scene analysis.
        </p>
      </div>
    );

  const previousSceneId = getAdjacentSceneId(
    rows,
    selectedRow.scene.id,
    "previous",
  );
  const nextSceneId = getAdjacentSceneId(rows, selectedRow.scene.id, "next");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <SceneNavigator
        approvedCount={approvedCount}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        onStatusChange={onStatusChange}
        query={query}
        rows={filteredRows}
        selectedSceneId={selectedRow.scene.id}
        status={status}
        totalCount={rows.length}
      />
      <div className="min-w-0 space-y-4">
        <SceneWorkspaceHeader
          nextDisabled={!nextSceneId}
          onNext={() => nextSceneId && onSelect(nextSceneId)}
          onPrevious={() => previousSceneId && onSelect(previousSceneId)}
          previousDisabled={!previousSceneId}
          sceneNumber={selectedRow.scene.sceneNumber}
          totalCount={rows.length}
        />
        <SceneCard
          canEdit={canEdit}
          key={selectedRow.scene.id}
          onDirtyChange={onDirtyChange}
          scene={selectedRow.scene}
          version={selectedRow.version}
          assignedCharacters={selectedRow.assignedCharacters}
          characterStaging={selectedRow.characterStaging}
          availableCharacters={availableCharacters}
          canGenerateImages={canGenerateImages}
          canReviewImages={canReviewImages}
          imageIndicator={selectedRow.imageIndicator}
          videoKind={videoKind}
        />
      </div>
    </div>
  );
}
