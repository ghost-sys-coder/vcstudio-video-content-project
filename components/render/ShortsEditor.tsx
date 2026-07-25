"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createShortCompositionAction,
  updateShortCompositionAction,
} from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import { ShortClipRow } from "@/components/render/ShortClipRow";
import { ShortClipTrimEditor } from "@/components/render/ShortClipTrimEditor";
import { ShortSceneMultiSelect } from "@/components/render/ShortSceneMultiSelect";
import { StartRenderButton } from "@/components/render/StartRenderButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ShortCompositionView,
  ShortSourceSceneView,
} from "@/lib/render/render-view";
import {
  sumDurationMilliseconds,
  type ShortDraftClip,
} from "@/lib/shorts/short-editor";

const EMPTY_NAME = "Untitled short";

export function ShortsEditor({
  projectId,
  verticalOutputVariantId,
  sourceScenes,
  savedShorts,
  canEdit,
  onSaved,
  onRender,
  onPreview,
  renderPending,
}: {
  projectId: string;
  verticalOutputVariantId: string | null;
  sourceScenes: ShortSourceSceneView[];
  savedShorts: ShortCompositionView[];
  canEdit: boolean;
  onSaved: () => Promise<void>;
  onRender: (shortCompositionId: string) => void;
  onPreview: (shortCompositionId: string) => void;
  renderPending: boolean;
}) {
  const [name, setName] = useState(EMPTY_NAME);
  const [clips, setClips] = useState<ShortDraftClip[]>([]);
  const [editingShortId, setEditingShortId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const availableScenes = useMemo(
    () =>
      sourceScenes.filter(
        (scene) => !clips.some((clip) => clip.sourceSceneId === scene.sceneId),
      ),
    [clips, sourceScenes],
  );
  const durationMilliseconds = sumDurationMilliseconds(
    clips.map((clip) => ({
      startMilliseconds: clip.sourceStartMilliseconds,
      endMilliseconds: clip.sourceEndMilliseconds,
    })),
  );

  function resetDraft() {
    setName(EMPTY_NAME);
    setClips([]);
    setEditingShortId(null);
  }

  function addSelectedScenes(sceneIds: string[]) {
    const idsInOrder = sourceScenes.filter((scene) =>
      sceneIds.includes(scene.sceneId),
    );
    setClips((current) => [
      ...current,
      ...idsInOrder.map((scene): ShortDraftClip => ({
        clientId: crypto.randomUUID(),
        sourceSceneId: scene.sceneId,
        sourceSceneVersionId: scene.sceneVersionId,
        sceneNumber: scene.sceneNumber,
        sourceStartMilliseconds: scene.startMilliseconds,
        sourceEndMilliseconds: scene.endMilliseconds,
        transition: "cut",
      })),
    ]);
    setMessage(null);
  }

  function updateClip(
    clientId: string,
    patch: {
      sourceStartMilliseconds: number;
      sourceEndMilliseconds: number;
      transition: "cut" | "fade";
    },
  ) {
    setClips((current) =>
      current.map((clip) =>
        clip.clientId === clientId ? { ...clip, ...patch } : clip,
      ),
    );
  }

  function editSavedShort(short: ShortCompositionView) {
    setName(short.name);
    setClips(
      short.clips.map((clip): ShortDraftClip => ({
        clientId: crypto.randomUUID(),
        sourceSceneId: clip.sourceSceneId,
        sourceSceneVersionId: clip.sourceSceneVersionId,
        sceneNumber:
          sourceScenes.find((scene) => scene.sceneId === clip.sourceSceneId)
            ?.sceneNumber ?? 0,
        sourceStartMilliseconds: clip.sourceStartMilliseconds,
        sourceEndMilliseconds: clip.sourceEndMilliseconds,
        transition: clip.transition,
      })),
    );
    setEditingShortId(short.id);
    setMessage(null);
  }

  function save() {
    if (!verticalOutputVariantId) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("outputVariantId", verticalOutputVariantId);
      formData.set("name", name);
      formData.set(
        "clips",
        JSON.stringify(
          clips.map((clip, index) => ({
            sourceSceneId: clip.sourceSceneId,
            sourceSceneVersionId: clip.sourceSceneVersionId,
            position: index + 1,
            sourceStartMilliseconds: clip.sourceStartMilliseconds,
            sourceEndMilliseconds: clip.sourceEndMilliseconds,
            transition: clip.transition,
          })),
        ),
      );
      if (editingShortId) formData.set("shortCompositionId", editingShortId);
      const result = editingShortId
        ? await updateShortCompositionAction(formData)
        : await createShortCompositionAction(formData);
      if (!result.success) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.warnings.length
          ? `Short saved. ${result.warnings[0]}`
          : "Short saved and ready to render.",
      );
      resetDraft();
      await onSaved();
    });
  }

  return (
    <section className="min-w-0 max-w-full space-y-4 overflow-hidden rounded-xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Shorts editor</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Multiselect scenes to build a short, then fine-tune each clip&apos;s
          range and transition. Audio is trimmed from the approved narration and
          captions are rebased—nothing is regenerated.
        </p>
      </div>

      {sourceScenes.length && verticalOutputVariantId ? (
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <ShortSceneMultiSelect
              availableScenes={availableScenes}
              disabled={!canEdit || pending}
              onAddSelected={addSelectedScenes}
            />
            {clips.length ? (
              <ShortClipTrimEditor
                clips={clips}
                disabled={!canEdit || pending}
                onUpdateClip={updateClip}
                sourceScenes={sourceScenes}
              />
            ) : null}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Short clips
              </h3>
              <span className="text-xs text-muted-foreground">
                {(durationMilliseconds / 1000).toFixed(1)}s
              </span>
            </div>
            {clips.length ? (
              <ol className="max-h-72 min-w-0 space-y-2 overflow-y-auto pr-1">
                {clips.map((clip, index) => (
                  <ShortClipRow
                    clip={clip}
                    disabled={pending}
                    index={index}
                    key={clip.clientId}
                    onMove={(direction) => {
                      setClips((current) => {
                        const next = [...current];
                        const target = index + direction;
                        [next[index], next[target]] = [
                          next[target]!,
                          next[index]!,
                        ];
                        return next;
                      });
                    }}
                    onRemove={() =>
                      setClips((current) =>
                        current.filter(
                          (candidate) => candidate.clientId !== clip.clientId,
                        ),
                      )
                    }
                    total={clips.length}
                  />
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                Select one or more scenes to add them in the order they should
                play.
              </p>
            )}
            <label className="block space-y-1 text-xs font-medium">
              Short name
              <Input
                disabled={!canEdit || pending}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!canEdit || pending || clips.length === 0}
                nativeButton
                onClick={save}
                type="button"
              >
                {pending
                  ? "Saving…"
                  : editingShortId
                    ? "Save changes"
                    : "Save short"}
              </Button>
              {editingShortId ? (
                <Button
                  disabled={pending}
                  nativeButton
                  onClick={() => {
                    resetDraft();
                    setMessage(null);
                  }}
                  type="button"
                  variant="ghost"
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
            {message ? (
              <p className="text-xs text-muted-foreground" role="status">
                {message}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          The approved source timeline and vertical output are required before
          creating shorts.
        </p>
      )}

      {savedShorts.length ? (
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saved shorts
          </h3>
          <ul className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {savedShorts.map((short) => (
              <li className="min-w-0 rounded-lg border p-3" key={short.id}>
                <p className="truncate text-sm font-medium">{short.name}</p>
                <p className="text-xs text-muted-foreground">
                  {short.clipCount} clips ·{" "}
                  {(short.durationMilliseconds / 1000).toFixed(1)}s
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    disabled={renderPending}
                    nativeButton
                    onClick={() => onPreview(short.id)}
                    type="button"
                    variant="outline"
                  >
                    Preview
                  </Button>
                  <Button
                    disabled={!canEdit || pending}
                    nativeButton
                    onClick={() => editSavedShort(short)}
                    type="button"
                    variant="outline"
                  >
                    Edit
                  </Button>
                  <StartRenderButton
                    disabled={!canEdit || renderPending}
                    estimatedCostCents={short.estimatedRenderCostCents}
                    onStart={() => onRender(short.id)}
                    pending={renderPending}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
