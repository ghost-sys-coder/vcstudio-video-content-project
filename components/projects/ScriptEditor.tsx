"use client";

import { useMemo, useState, useTransition } from "react";
import type { ProjectScriptDraft, ProjectScriptVersion } from "@/db/schema";
import {
  createScriptVersionAction,
  saveScriptDraftAction,
} from "@/app/(authenticated)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScriptStatistics } from "@/components/projects/ScriptStatistics";
import { ScriptVersionHistory } from "@/components/projects/ScriptVersionHistory";
import { calculateScriptStatistics } from "@/lib/domain/script-statistics";

export function ScriptEditor({
  draft,
  versions,
  maximumCharacters,
  canEdit,
}: {
  draft: ProjectScriptDraft;
  versions: ProjectScriptVersion[];
  maximumCharacters: number;
  canEdit: boolean;
}) {
  const [content, setContent] = useState(draft.content);
  const [revision, setRevision] = useState(draft.revision);
  const [savedContent, setSavedContent] = useState(draft.content);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const statistics = useMemo(
    () => calculateScriptStatistics(content),
    [content],
  );
  function formData() {
    const data = new FormData();
    data.set("projectId", draft.projectId);
    data.set("content", content);
    data.set("revision", String(revision));
    return data;
  }
  function save() {
    startTransition(async () => {
      setError(null);
      const result = await saveScriptDraftAction(formData());
      if (result.success && result.revision !== undefined) {
        setRevision(result.revision);
        setSavedContent(content);
        setMessage("Draft saved.");
      } else setError(result.error);
    });
  }
  function version() {
    startTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("projectId", draft.projectId);
      data.set("revision", String(revision));
      const result = await createScriptVersionAction(data);
      if (result.success) setMessage("Version created.");
      else setError(result.error);
    });
  }
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="space-y-4">
        <Textarea
          aria-label="Narration script"
          className="h-[clamp(28rem,65svh,48rem)] min-h-0 resize-none overflow-y-auto font-mono leading-7 field-sizing-fixed"
          disabled={!canEdit || pending}
          maxLength={maximumCharacters}
          onChange={(event) => setContent(event.target.value)}
          value={content}
        />
        <ScriptStatistics
          maximumCharacters={maximumCharacters}
          statistics={statistics}
        />
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <>
              <Button
                disabled={
                  pending ||
                  content === savedContent ||
                  statistics.characterCount > maximumCharacters
                }
                onClick={save}
                type="button"
              >
                Save draft
              </Button>
              <Button
                disabled={pending || content !== savedContent}
                onClick={version}
                type="button"
                variant="outline"
              >
                Create version
              </Button>
            </>
          ) : null}
        </div>
        {content !== savedContent ? (
          <p className="text-xs text-amber-700">Unsaved draft changes</p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-emerald-700" role="status">
            {message}
          </p>
        ) : null}
      </section>
      <ScriptVersionHistory
        canEdit={canEdit}
        onRestored={(next) => {
          setRevision(next);
          window.location.reload();
        }}
        revision={revision}
        versions={versions}
      />
    </div>
  );
}
