"use client";
import { useMemo } from "react";
import type { ProjectScriptDraft, ProjectScriptVersion } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScriptStatistics } from "@/components/projects/ScriptStatistics";
import { ScriptVersionHistory } from "@/components/projects/ScriptVersionHistory";
import { ScriptDraftNotices } from "@/components/projects/ScriptDraftNotices";
import { calculateScriptStatistics } from "@/lib/domain/script-statistics";
import { buildScriptStructureView } from "@/lib/scripts/script-structure-view";
import { ScriptStructureNotice } from "@/components/projects/ScriptStructureNotice";
import { useScriptDraft } from "@/hooks/use-script-draft";

export function ScriptEditor({
  draft,
  versions,
  maximumCharacters,
  canEdit,
  userId,
}: {
  draft: ProjectScriptDraft;
  versions: ProjectScriptVersion[];
  maximumCharacters: number;
  canEdit: boolean;
  userId: string;
}) {
  const { state, controller } = useScriptDraft({
    initial: draft,
    maximumCharacters,
    canEdit,
    userId,
    workspaceId: draft.workspaceId,
    projectId: draft.projectId,
  });
  const statistics = useMemo(
    () => calculateScriptStatistics(state.content),
    [state.content],
  );
  const structure = useMemo(
    () => buildScriptStructureView(state.content),
    [state.content],
  );
  const busy = state.saving || state.approving;
  const unresolved = Boolean(state.remote || state.recovery || state.generated);
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="space-y-4">
        <p className="text-sm text-muted-foreground" role="status">
          {state.approving
            ? "Saving and approving this script…"
            : state.approved
              ? "Script saved and approved for production."
              : state.status === "saved"
                ? "All changes saved."
                : state.status === "saving"
                  ? "Saving… You can keep writing."
                  : state.status === "unsaved"
                    ? "Unsaved changes — autosave pending."
                    : "Draft needs attention below."}
        </p>
        <ScriptStructureNotice view={structure} />
        <Textarea
          aria-label="Narration script"
          className="h-[clamp(28rem,65svh,48rem)] min-h-0 resize-none overflow-y-auto font-mono leading-7 field-sizing-fixed"
          disabled={!canEdit || state.approving || Boolean(state.recovery)}
          maxLength={maximumCharacters}
          onChange={(event) => controller.edit(event.target.value)}
          value={state.content}
        />
        <ScriptStatistics
          maximumCharacters={maximumCharacters}
          statistics={statistics}
        />
        <ScriptDraftNotices state={state} controller={controller} />
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                busy ||
                unresolved ||
                (state.content === state.savedContent &&
                  state.status !== "error") ||
                state.content.length > maximumCharacters
              }
              onClick={() => void controller.save()}
              type="button"
              variant="outline"
            >
              Save now
            </Button>
            <Button
              disabled={
                state.approving ||
                unresolved ||
                !state.content.trim() ||
                state.content.length > maximumCharacters ||
                state.approved
              }
              onClick={() => void controller.save(true)}
              type="button"
            >
              Save and approve for production
            </Button>
            <Button
              disabled={
                busy || state.content === state.savedContent || unresolved
              }
              onClick={() => controller.discard()}
              type="button"
              variant="outline"
            >
              Discard unsaved changes
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Autosave stores the draft. Approval freezes a version for scene
          production and starts no paid generation. Local recovery lasts up to
          seven days in this tab and is cleared on sign-out.
        </p>
      </section>
      <ScriptVersionHistory
        canEdit={
          canEdit &&
          !busy &&
          !unresolved &&
          state.content === state.savedContent
        }
        onRestored={() => window.location.reload()}
        revision={state.revision}
        versions={versions}
      />
    </div>
  );
}
