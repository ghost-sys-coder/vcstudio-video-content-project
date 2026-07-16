"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Character, Scene, SceneVersion } from "@/db/schema";
import { SceneCard } from "@/components/scenes/SceneCard";
import { SceneNavigator } from "@/components/scenes/SceneNavigator";
import { SceneWorkspaceHeader } from "@/components/scenes/SceneWorkspaceHeader";
import {
  filterSceneRows,
  findInitialSceneId,
  getAdjacentSceneId,
  type SceneStatusFilter,
} from "@/lib/scenes/scene-navigation";

export function SceneList({
  rows,
  canEdit,
  initialSceneNumber,
  availableCharacters,
  projectAspectRatio,
  canGenerateImages,
  canReviewImages,
}: {
  rows: Array<{
    scene: Scene;
    version: SceneVersion;
    assignedCharacters: Character[];
  }>;
  canEdit: boolean;
  initialSceneNumber: number | null;
  availableCharacters: Character[];
  projectAspectRatio: "16:9" | "9:16" | "1:1";
  canGenerateImages: boolean;
  canReviewImages: boolean;
}) {
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(() =>
    findInitialSceneId(rows, initialSceneNumber),
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SceneStatusFilter>("all");
  const [dirty, setDirty] = useState(false);
  const allowPageExit = useRef(false);
  const selectedRow =
    rows.find((row) => row.scene.id === selectedSceneId) ?? rows[0] ?? null;
  const filteredRows = useMemo(
    () => filterSceneRows(rows, query, status),
    [query, rows, status],
  );
  const approvedCount = rows.filter(
    (row) => row.scene.status === "approved",
  ).length;
  const updateUrl = useCallback((sceneNumber: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("scene", String(sceneNumber));
    window.history.pushState({ sceneNumber }, "", url);
  }, []);
  const selectScene = useCallback(
    (sceneId: string, updateHistory = true) => {
      if (sceneId === selectedSceneId) return;
      if (
        dirty &&
        !window.confirm(
          "You have unsaved scene changes. Discard them and continue?",
        )
      )
        return;

      const nextRow = rows.find((row) => row.scene.id === sceneId);
      if (!nextRow) return;
      setDirty(false);
      setSelectedSceneId(sceneId);
      if (updateHistory) updateUrl(nextRow.scene.sceneNumber);
    },
    [dirty, rows, selectedSceneId, updateUrl],
  );

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowPageExit.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.href === window.location.href) return;
      const discardChanges = window.confirm(
        "You have unsaved scene changes. Discard them and continue?",
      );
      if (!discardChanges) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        allowPageExit.current = true;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [dirty]);

  useEffect(() => {
    const handlePopState = () => {
      const sceneNumber = Number(
        new URL(window.location.href).searchParams.get("scene"),
      );
      const nextSceneId = findInitialSceneId(
        rows,
        Number.isInteger(sceneNumber) ? sceneNumber : null,
      );
      if (!nextSceneId || nextSceneId === selectedSceneId) return;
      if (
        dirty &&
        !window.confirm(
          "You have unsaved scene changes. Discard them and continue?",
        )
      ) {
        if (selectedRow) {
          const url = new URL(window.location.href);
          url.searchParams.set("scene", String(selectedRow.scene.sceneNumber));
          window.history.replaceState({}, "", url);
        }
        return;
      }
      setDirty(false);
      setSelectedSceneId(nextSceneId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dirty, rows, selectedRow, selectedSceneId]);

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
        onQueryChange={setQuery}
        onSelect={selectScene}
        onStatusChange={setStatus}
        query={query}
        rows={filteredRows}
        selectedSceneId={selectedRow.scene.id}
        status={status}
        totalCount={rows.length}
      />
      <div className="min-w-0 space-y-4">
        <SceneWorkspaceHeader
          nextDisabled={!nextSceneId}
          onNext={() => nextSceneId && selectScene(nextSceneId)}
          onPrevious={() => previousSceneId && selectScene(previousSceneId)}
          previousDisabled={!previousSceneId}
          sceneNumber={selectedRow.scene.sceneNumber}
          totalCount={rows.length}
        />
        <SceneCard
          canEdit={canEdit}
          key={selectedRow.scene.id}
          onDirtyChange={(nextDirty) => {
            allowPageExit.current = false;
            setDirty(nextDirty);
          }}
          scene={selectedRow.scene}
          version={selectedRow.version}
          assignedCharacters={selectedRow.assignedCharacters}
          availableCharacters={availableCharacters}
          projectAspectRatio={projectAspectRatio}
          canGenerateImages={canGenerateImages}
          canReviewImages={canReviewImages}
        />
      </div>
    </div>
  );
}
