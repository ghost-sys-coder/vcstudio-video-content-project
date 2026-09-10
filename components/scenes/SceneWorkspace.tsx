"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Character,
  ProjectVideoKind,
  Scene,
  SceneVersion,
} from "@/db/schema";
import { WorkspaceViewSwitch } from "@/components/production/WorkspaceViewSwitch";
import { SceneList } from "@/components/scenes/SceneList";
import {
  readSceneWorkspaceState,
  sceneWorkspaceSearch,
  type SceneWorkspaceState,
} from "@/lib/production/scene-workspace-state";
import { SCENE_WORKSPACE_VIEWS } from "@/lib/production/workspace-views";
import type { SceneCharacterStaging } from "@/lib/scenes/scene-character-staging";
import type { SceneImageIndicator } from "@/lib/scenes/scene-image-indicator";
import { findInitialSceneId } from "@/lib/scenes/scene-navigation";

const UNSAVED_PROMPT =
  "You have unsaved scene changes. Discard them and continue?";

/**
 * The scene context: the view switch, the analysis panels, and the editor.
 *
 * This component owns everything that has to survive a change of view — which
 * scene is open, the search and status filter, the grid's filter, and whether
 * the editor holds unsaved work. The state lives here rather than in the list
 * because the list is only one of the two views, and state held inside it would
 * be discarded the moment a creator switched to the grid.
 *
 * State is mirrored into the address bar with the history API rather than the
 * router, so filtering and moving between scenes never costs a server round
 * trip, while a reload or a shared link still lands in the same place.
 */
export function SceneWorkspace({
  children,
  projectId,
  initialState,
  rows,
  canEdit,
  availableCharacters,
  canGenerateImages,
  canReviewImages,
  videoKind,
}: {
  children: React.ReactNode;
  projectId: string;
  initialState: SceneWorkspaceState;
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
}) {
  const [state, setState] = useState<SceneWorkspaceState>(initialState);
  const [dirty, setDirty] = useState(false);
  const allowPageExit = useRef(false);

  const selectedSceneId = useMemo(
    () => findInitialSceneId(rows, state.sceneNumber),
    [rows, state.sceneNumber],
  );

  const applyState = useCallback(
    (change: Partial<SceneWorkspaceState>, mode: "push" | "replace") => {
      setState((current) => {
        const next = { ...current, ...change };
        const url = `${window.location.pathname}${sceneWorkspaceSearch(next)}`;
        if (mode === "push") window.history.pushState({}, "", url);
        else window.history.replaceState({}, "", url);
        return next;
      });
    },
    [],
  );

  const selectScene = useCallback(
    (sceneId: string) => {
      if (sceneId === selectedSceneId) return;
      if (dirty && !window.confirm(UNSAVED_PROMPT)) return;
      const nextRow = rows.find((row) => row.scene.id === sceneId);
      if (!nextRow) return;
      setDirty(false);
      applyState({ sceneNumber: nextRow.scene.sceneNumber }, "push");
    },
    [applyState, dirty, rows, selectedSceneId],
  );

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowPageExit.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    // Catches the view switch too: it is a real link, so leaving unsaved scene
    // work behind by switching views asks the same question as leaving the page.
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.href === window.location.href) return;
      if (window.confirm(UNSAVED_PROMPT)) allowPageExit.current = true;
      else {
        event.preventDefault();
        event.stopPropagation();
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
      const params = Object.fromEntries(
        new URL(window.location.href).searchParams.entries(),
      );
      const next = readSceneWorkspaceState(params);
      const nextSceneId = findInitialSceneId(rows, next.sceneNumber);
      if (nextSceneId && nextSceneId !== selectedSceneId && dirty) {
        if (!window.confirm(UNSAVED_PROMPT)) {
          // Put the address bar back where the creator actually is.
          setState((current) => {
            window.history.replaceState(
              {},
              "",
              `${window.location.pathname}${sceneWorkspaceSearch(current)}`,
            );
            return current;
          });
          return;
        }
        setDirty(false);
      }
      setState(next);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dirty, rows, selectedSceneId]);

  return (
    <div className="space-y-6">
      <WorkspaceViewSwitch
        activeViewId="detail"
        projectId={projectId}
        search={sceneWorkspaceSearch(state)}
        views={SCENE_WORKSPACE_VIEWS}
      />
      {children}
      <SceneList
        availableCharacters={availableCharacters}
        canEdit={canEdit}
        canGenerateImages={canGenerateImages}
        canReviewImages={canReviewImages}
        onDirtyChange={(nextDirty) => {
          allowPageExit.current = false;
          setDirty(nextDirty);
        }}
        onQueryChange={(query) => applyState({ query }, "replace")}
        onSelect={selectScene}
        onStatusChange={(status) => applyState({ status }, "replace")}
        query={state.query}
        rows={rows}
        selectedSceneId={selectedSceneId}
        status={state.status}
        videoKind={videoKind}
      />
    </div>
  );
}
