"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { persistScriptDraftAction } from "@/app/(authenticated)/app/projects/[projectId]/script/actions";
import { ScriptDraftController } from "@/lib/scripts/script-draft-controller";
import { createScriptRecoveryStore } from "@/lib/scripts/script-recovery";
import type { ScriptDraftSnapshot } from "@/lib/scripts/script-draft-contract";

export function useScriptDraft(input: {
  userId: string;
  workspaceId: string;
  projectId: string;
  initial: ScriptDraftSnapshot;
  maximumCharacters: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [controller] = useState(
    () =>
      new ScriptDraftController({
        ...input,
        persist: (request) =>
          persistScriptDraftAction({ ...request, projectId: input.projectId }),
        approved: () => router.refresh(),
      }),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  useEffect(() => {
    let store = null;
    try {
      const tabId =
        sessionStorage.getItem("vcstudio:script-tab") ?? crypto.randomUUID();
      sessionStorage.setItem("vcstudio:script-tab", tabId);
      store = createScriptRecoveryStore(localStorage, { ...input, tabId });
    } catch {
      /* The editor reports unavailable local recovery. */
    }
    controller.start(store);
    function insert(event: Event) {
      if (event instanceof CustomEvent && typeof event.detail === "string")
        controller.offerGenerated(event.detail);
    }
    function reconnect() {
      if (controller.getSnapshot().status === "error") void controller.save();
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      const current = controller.getSnapshot();
      if (
        current.content !== current.savedContent ||
        current.approving ||
        current.saving
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    function clear() {
      controller.stop();
    }
    window.addEventListener("vcstudio:insert-script", insert);
    window.addEventListener("vcstudio:clear-script-recovery", clear);
    window.addEventListener("online", reconnect);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      controller.stop();
      window.removeEventListener("vcstudio:insert-script", insert);
      window.removeEventListener("vcstudio:clear-script-recovery", clear);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("beforeunload", beforeUnload);
    };
    // Scope changes remount ScriptEditor through its server-provided key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controller]);
  return { state, controller };
}
