"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  cancelRenderAction,
  startRenderAction,
} from "@/app/(authenticated)/app/projects/[projectId]/render/actions";
import { ExportList } from "@/components/render/ExportList";
import { RenderProgressPanel } from "@/components/render/RenderProgressPanel";
import { RenderSettingsForm } from "@/components/render/RenderSettingsForm";
import { RenderValidationDialog } from "@/components/render/RenderValidationDialog";
import { TimelineSummary } from "@/components/render/TimelineSummary";
import { VideoPreviewPlayer } from "@/components/render/VideoPreviewPlayer";
import { SceneFramingEditor } from "@/components/render/SceneFramingEditor";
import { ShortsEditor } from "@/components/render/ShortsEditor";
import type {
  RenderActionIssue,
  RenderActionResult,
  RenderWorkspaceView,
  StartRenderInput,
} from "@/lib/render/render-view";
import { renderWorkspaceResponseSchema } from "@/lib/schemas/render-response";

const POLL_INTERVAL_MS = 4_000;

export function VideoPreviewWorkspace({
  projectId,
  initialData,
  canRender,
}: {
  projectId: string;
  initialData: RenderWorkspaceView;
  canRender: boolean;
}) {
  const [data, setData] = useState<RenderWorkspaceView>(initialData);
  const [refreshToken, setRefreshToken] = useState(0);
  const [pending, startTransition] = useTransition();
  const [startError, setStartError] = useState<string | null>(null);
  const [issues, setIssues] = useState<RenderActionIssue[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewShort, setPreviewShort] = useState<{
    id: string;
    outputVariantId: string;
  } | null>(null);
  const refreshing = useRef(false);

  const refresh = useCallback(
    async (outputVariantId?: string) => {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const query = outputVariantId
          ? `?outputVariantId=${encodeURIComponent(outputVariantId)}`
          : "";
        const response = await fetch(
          `/api/projects/${projectId}/renders${query}`,
          { cache: "no-store" },
        );
        const payload: unknown = await response.json();
        const parsed = renderWorkspaceResponseSchema.safeParse(payload);
        if (response.ok && parsed.success && parsed.data.success)
          setData(parsed.data.data);
      } finally {
        refreshing.current = false;
      }
    },
    [projectId],
  );

  useEffect(() => {
    const hasActiveOutpaint = data.sceneFramings.some(
      (scene) =>
        scene.outpaintStatus === "queued" || scene.outpaintStatus === "running",
    );
    if (!data.activeRender && !hasActiveOutpaint) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh(data.selectedOutputVariantId);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [
    data.activeRender,
    data.sceneFramings,
    data.selectedOutputVariantId,
    refresh,
  ]);

  const handleStart = useCallback(
    (input: StartRenderInput) => {
      startTransition(async () => {
        setStartError(null);
        setIssues([]);
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("outputVariantId", input.outputVariantId);
        if (input.shortCompositionId)
          formData.set("shortCompositionId", input.shortCompositionId);
        formData.set("presetId", input.presetId);
        formData.set("includeCaptions", String(input.includeCaptions));
        formData.set("includeWatermark", String(input.includeWatermark));
        formData.set("requestNonce", crypto.randomUUID());
        const result: RenderActionResult = await startRenderAction(formData);
        if (result.success) {
          await refresh(input.outputVariantId);
          return;
        }
        if (result.issues && result.issues.length > 0) {
          setIssues(result.issues);
          setDialogOpen(true);
          return;
        }
        setStartError(result.error);
      });
    },
    [projectId, refresh],
  );

  const handleCancel = useCallback(
    async (renderId: string): Promise<RenderActionResult> => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("renderId", renderId);
      const result = await cancelRenderAction(formData);
      if (result.success) await refresh(data.selectedOutputVariantId);
      return result;
    },
    [data.selectedOutputVariantId, projectId, refresh],
  );

  const timelineReady = data.timeline.status === "ready";

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-dashed bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Preview &amp; render</h2>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Preview the assembled video, then render it to a downloadable MP4.
              Rendering runs in the background and reserves budget up front.
            </p>
          </div>
          <button
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => {
              setRefreshToken((token) => token + 1);
              void refresh(data.selectedOutputVariantId);
            }}
            type="button"
          >
            Refresh
          </button>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <VideoPreviewPlayer
            outputVariantId={
              previewShort?.outputVariantId ?? data.selectedOutputVariantId
            }
            projectId={projectId}
            refreshToken={refreshToken}
            shortCompositionId={previewShort?.id}
          />
          <RenderSettingsForm
            availableBudgetCents={data.availableBudgetCents}
            canRender={canRender}
            configuration={data.configuration}
            onStart={handleStart}
            onOutputVariantChange={(outputVariantId) => {
              setPreviewShort(null);
              setRefreshToken((token) => token + 1);
              void refresh(outputVariantId);
            }}
            pending={pending}
            presets={data.presets}
            selectedOutputVariantId={data.selectedOutputVariantId}
            timelineReady={timelineReady}
            watermarkAvailable={data.configuration.watermarkAvailable}
          />
          {startError ? (
            <p className="text-xs text-destructive" role="alert">
              {startError}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <TimelineSummary timeline={data.timeline} />
          {data.activeRender ? (
            <RenderProgressPanel
              onCancel={handleCancel}
              render={data.activeRender}
            />
          ) : null}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold">Exports</h2>
            <ExportList exports={data.exports} projectId={projectId} />
          </div>
        </div>
      </div>

      <SceneFramingEditor
        canEdit={canRender}
        outpaintEstimatedCostCents={
          data.configuration.outpaintEstimatedCostCents
        }
        height={data.timeline.height}
        key={data.selectedOutputVariantId}
        onSaved={async () => {
          setRefreshToken((token) => token + 1);
          await refresh(data.selectedOutputVariantId);
        }}
        outputVariantId={data.selectedOutputVariantId}
        projectId={projectId}
        scenes={data.sceneFramings}
        width={data.timeline.width}
      />

      <ShortsEditor
        canEdit={canRender}
        onSaved={async () => {
          await refresh(data.selectedOutputVariantId);
        }}
        onRender={(shortCompositionId) => {
          const vertical = data.presets.find(
            (preset) => preset.aspectRatio === "9:16",
          );
          if (!vertical) return;
          handleStart({
            presetId: vertical.id,
            outputVariantId: vertical.outputVariantId,
            shortCompositionId,
            includeCaptions: true,
            includeWatermark: false,
          });
        }}
        onPreview={(shortCompositionId) => {
          const vertical = data.presets.find(
            (preset) => preset.aspectRatio === "9:16",
          );
          if (!vertical) return;
          setPreviewShort({
            id: shortCompositionId,
            outputVariantId: vertical.outputVariantId,
          });
          setRefreshToken((token) => token + 1);
        }}
        projectId={projectId}
        savedShorts={data.shorts}
        renderPending={pending}
        sourceScenes={data.shortSourceScenes}
        verticalOutputVariantId={
          data.presets.find((preset) => preset.aspectRatio === "9:16")
            ?.outputVariantId ?? null
        }
      />

      <RenderValidationDialog
        issues={issues}
        onOpenChange={setDialogOpen}
        open={dialogOpen}
      />
    </div>
  );
}
