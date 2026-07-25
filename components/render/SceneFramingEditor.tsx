"use client";

import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  saveSceneFramingAction,
  startSceneOutpaintAction,
} from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import { OutpaintConfirmDialog } from "@/components/render/OutpaintConfirmDialog";
import { SceneFramingBulkApply } from "@/components/render/SceneFramingBulkApply";
import { SceneFramingChip } from "@/components/render/SceneFramingChip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RenderSceneFramingView } from "@/lib/render/render-view";
import {
  DEFAULT_SCENE_FRAMING,
  focalPointFromPointerOffset,
  framingObjectPosition,
  framingScale,
} from "@/lib/output-variants/scene-framing";

export function SceneFramingEditor({
  projectId,
  outputVariantId,
  width,
  height,
  scenes,
  canEdit,
  outpaintEstimatedCostCents,
  onSaved,
}: {
  projectId: string;
  outputVariantId: string;
  width: number;
  height: number;
  scenes: RenderSceneFramingView[];
  canEdit: boolean;
  outpaintEstimatedCostCents: number;
  onSaved: () => Promise<void>;
}) {
  const [selectedSceneId, setSelectedSceneId] = useState(
    scenes[0]?.sceneId ?? "",
  );
  const selected = useMemo(
    () =>
      scenes.find((scene) => scene.sceneId === selectedSceneId) ??
      scenes[0] ??
      null,
    [scenes, selectedSceneId],
  );
  const [mode, setMode] = useState<"cover" | "contain">(
    scenes[0]?.mode === "contain" ? "contain" : "cover",
  );
  const [focalX, setFocalX] = useState(scenes[0]?.focalPointXBps ?? 5000);
  const [focalY, setFocalY] = useState(scenes[0]?.focalPointYBps ?? 5000);
  const [scale, setScale] = useState(scenes[0]?.scaleBps ?? 10000);
  const [backgroundColor, setBackgroundColor] = useState(
    scenes[0]?.backgroundColor ?? "#000000",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [outpaintDialogOpen, setOutpaintDialogOpen] = useState(false);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const outpaintPending =
    selected?.outpaintStatus === "queued" ||
    selected?.outpaintStatus === "running";
  const editingDisabled = !canEdit || pending;

  if (!selected)
    return (
      <section className="min-w-0 max-w-full rounded-xl border border-dashed p-4">
        <h2 className="text-sm font-semibold">Scene framing</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approve scene images before adapting this output format.
        </p>
      </section>
    );

  const framing = {
    mode,
    focalPointXBps: focalX,
    focalPointYBps: focalY,
    scaleBps: scale,
    backgroundColor,
  } as const;
  const imageUrl = `/api/projects/${projectId}/scene-images/${selected.sourceImageGenerationId}/asset`;

  function updateFocalFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const { focalPointXBps, focalPointYBps } = focalPointFromPointerOffset({
      offsetXRatio: (event.clientX - rect.left) / rect.width,
      offsetYRatio: (event.clientY - rect.top) / rect.height,
    });
    setFocalX(focalPointXBps);
    setFocalY(focalPointYBps);
  }

  function startOutpaint() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("outputVariantId", outputVariantId);
      formData.set("sceneId", selected.sceneId);
      formData.set("sceneVersionId", selected.sceneVersionId);
      formData.set(
        "sourceImageGenerationId",
        selected.approvedSourceImageGenerationId,
      );
      formData.set("requestNonce", crypto.randomUUID());
      const result = await startSceneOutpaintAction(formData);
      setOutpaintDialogOpen(false);
      if (result.success) toast.success("Outpaint queued.");
      else toast.error(result.error);
      await onSaved();
    });
  }

  return (
    <section className="min-w-0 max-w-full space-y-4 overflow-hidden rounded-xl border p-4">
      <div>
        <h2 className="text-sm font-semibold">Scene framing</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Reuse the approved image by positioning it for this output. No AI
          generation or image charge is involved.
        </p>
      </div>

      {selected.hasNativeMatch ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Scene {selected.sceneNumber} already has a natively-generated image at
          this exact size — the render will use it directly, and the
          framing/outpaint settings below won&apos;t be applied to it.
        </p>
      ) : null}

      <div
        className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1"
        aria-label="Scenes"
      >
        {scenes.map((scene) => (
          <SceneFramingChip
            active={scene.sceneId === selected.sceneId}
            key={scene.sceneId}
            onSelect={() => {
              setSelectedSceneId(scene.sceneId);
              setMode(scene.mode === "contain" ? "contain" : "cover");
              setFocalX(scene.focalPointXBps);
              setFocalY(scene.focalPointYBps);
              setScale(scene.scaleBps);
              setBackgroundColor(scene.backgroundColor);
              setMessage(null);
            }}
            scene={scene}
          />
        ))}
      </div>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div
          className={cn(
            "relative mx-auto w-full max-w-xl touch-none overflow-hidden rounded-lg border",
            editingDisabled ? "cursor-not-allowed" : "cursor-crosshair",
          )}
          onPointerDown={(event) => {
            if (editingDisabled) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            updateFocalFromPointer(event);
          }}
          onPointerMove={(event) => {
            if (!dragging || editingDisabled) return;
            updateFocalFromPointer(event);
          }}
          onPointerUp={() => setDragging(false)}
          ref={imageContainerRef}
          style={{ aspectRatio: `${width} / ${height}`, backgroundColor }}
        >
          <Image
            alt={`Scene ${selected.sceneNumber} framing preview`}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            src={imageUrl}
            style={{
              objectFit: mode,
              objectPosition: framingObjectPosition(framing),
              transform: `scale(${framingScale(scale)})`,
            }}
            unoptimized
          />
          <span
            aria-hidden
            className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
            style={{ left: `${focalX / 100}%`, top: `${focalY / 100}%` }}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <p className="text-xs text-muted-foreground">
            Click or drag on the image to set the focal point, or use the
            sliders below.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">Fit mode</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["cover", "contain"] as const).map((value) => (
                <Button
                  aria-pressed={mode === value}
                  disabled={editingDisabled}
                  key={value}
                  nativeButton
                  onClick={() => setMode(value)}
                  type="button"
                  variant={mode === value ? "default" : "outline"}
                >
                  {value === "cover" ? "Fill frame" : "Show all"}
                </Button>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1 text-xs font-medium">
            Horizontal focus · {Math.round(focalX / 100)}%
            <input
              className="w-full accent-primary"
              disabled={editingDisabled}
              max={10000}
              min={0}
              onChange={(event) => setFocalX(Number(event.target.value))}
              step={100}
              type="range"
              value={focalX}
            />
          </label>
          <label className="block space-y-1 text-xs font-medium">
            Vertical focus · {Math.round(focalY / 100)}%
            <input
              className="w-full accent-primary"
              disabled={editingDisabled}
              max={10000}
              min={0}
              onChange={(event) => setFocalY(Number(event.target.value))}
              step={100}
              type="range"
              value={focalY}
            />
          </label>
          <label className="block space-y-1 text-xs font-medium">
            Scale · {Math.round(scale / 100)}%
            <input
              className="w-full accent-primary"
              disabled={editingDisabled}
              max={20000}
              min={10000}
              onChange={(event) => setScale(Number(event.target.value))}
              step={100}
              type="range"
              value={scale}
            />
          </label>
          {mode === "contain" ? (
            <label className="flex items-center justify-between gap-3 text-xs font-medium">
              Background
              <input
                aria-label="Frame background color"
                disabled={editingDisabled}
                onChange={(event) => setBackgroundColor(event.target.value)}
                type="color"
                value={backgroundColor}
              />
            </label>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={editingDisabled}
              nativeButton
              onClick={() => {
                startTransition(async () => {
                  const formData = new FormData();
                  formData.set("projectId", projectId);
                  formData.set("outputVariantId", outputVariantId);
                  formData.set("sceneId", selected.sceneId);
                  formData.set("sceneVersionId", selected.sceneVersionId);
                  formData.set(
                    "sourceImageGenerationId",
                    selected.approvedSourceImageGenerationId,
                  );
                  formData.set("mode", mode);
                  formData.set("focalPointXBps", String(focalX));
                  formData.set("focalPointYBps", String(focalY));
                  formData.set("scaleBps", String(scale));
                  formData.set("backgroundColor", backgroundColor);
                  const result = await saveSceneFramingAction(formData);
                  setMessage(result.success ? "Framing saved." : result.error);
                  if (result.success) await onSaved();
                });
              }}
              type="button"
            >
              {pending ? "Saving…" : "Save framing"}
            </Button>
            <Button
              disabled={editingDisabled}
              nativeButton
              onClick={() => {
                setMode(
                  DEFAULT_SCENE_FRAMING.mode === "contain"
                    ? "contain"
                    : "cover",
                );
                setFocalX(DEFAULT_SCENE_FRAMING.focalPointXBps);
                setFocalY(DEFAULT_SCENE_FRAMING.focalPointYBps);
                setScale(DEFAULT_SCENE_FRAMING.scaleBps);
                setBackgroundColor(DEFAULT_SCENE_FRAMING.backgroundColor);
                setMessage(null);
              }}
              type="button"
              variant="ghost"
            >
              Reset to default
            </Button>
          </div>

          <SceneFramingBulkApply
            activeSceneId={selected.sceneId}
            disabled={editingDisabled}
            framing={framing}
            onApplied={onSaved}
            outputVariantId={outputVariantId}
            projectId={projectId}
            scenes={scenes}
          />

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
            <p className="font-semibold">AI canvas extension</p>
            <p className="mt-1">
              Extends this approved image for the selected format. Conservative
              estimate:{" "}
              {(outpaintEstimatedCostCents / 100).toLocaleString(undefined, {
                style: "currency",
                currency: "USD",
              })}
              .
            </p>
            <Button
              className="mt-3 w-full"
              disabled={!canEdit || pending || outpaintPending}
              nativeButton
              onClick={() => setOutpaintDialogOpen(true)}
              type="button"
              variant="outline"
            >
              {outpaintPending
                ? `Outpaint ${selected.outpaintStatus}…`
                : "Generate outpaint"}
            </Button>
            {selected.outpaintStatus === "failed" ? (
              <p className="mt-2 text-destructive" role="alert">
                {selected.outpaintError ??
                  "The outpaint failed. You can try a new paid generation."}
              </p>
            ) : null}
          </div>
          {message ? (
            <p
              className={cn(
                "text-xs",
                message === "Framing saved."
                  ? "text-emerald-700"
                  : "text-destructive",
              )}
              role="status"
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>

      <OutpaintConfirmDialog
        estimatedCostCents={outpaintEstimatedCostCents}
        onConfirm={startOutpaint}
        onOpenChange={setOutpaintDialogOpen}
        open={outpaintDialogOpen}
        pending={pending}
      />
    </section>
  );
}
