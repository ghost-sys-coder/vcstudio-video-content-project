"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  approveSceneAudioAction,
  cancelSceneAudioAction,
  createVoicePresetAction,
  rejectSceneAudioAction,
  startSceneAudioGenerationAction,
} from "@/app/(authenticated)/app/projects/[projectId]/audio/actions";
import { Button } from "@/components/ui/button";
import { ApproveSelectedAudioButton } from "@/components/audio/ApproveSelectedAudioButton";
import { AudioGenerationProgress } from "@/components/audio/AudioGenerationProgress";
import { BulkGenerateAudioButton } from "@/components/audio/BulkGenerateAudioButton";
import { SceneAudioList } from "@/components/audio/SceneAudioList";
import { VoicePresetSelector } from "@/components/audio/VoicePresetSelector";
import { VoicePreviewPanel } from "@/components/audio/VoicePreviewPanel";
import type {
  AudioGenerateInput,
  AudioWorkspaceView,
  SceneAudioActionResult,
} from "@/lib/audio/audio-view";
import { audioWorkspaceResponseSchema } from "@/lib/schemas/audio-response";

const POLL_INTERVAL_MS = 4_000;

export function AudioWorkspace({
  projectId,
  initialData,
  canGenerate,
  canReview,
  canManageVoicePresets,
}: {
  projectId: string;
  initialData: AudioWorkspaceView;
  canGenerate: boolean;
  canReview: boolean;
  canManageVoicePresets: boolean;
}) {
  const [data, setData] = useState<AudioWorkspaceView>(initialData);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [voicePresetId, setVoicePresetId] = useState<string>(
    () =>
      initialData.voicePresets.find((preset) => preset.isDefault)?.id ??
      initialData.voicePresets[0]?.id ??
      "",
  );
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch(`/api/projects/${projectId}/audio`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      const parsed = audioWorkspaceResponseSchema.safeParse(payload);
      if (response.ok && parsed.success && parsed.data.success) {
        const nextData = parsed.data.data;
        setData(nextData);
        setVoicePresetId((current) =>
          nextData.voicePresets.some((preset) => preset.id === current)
            ? current
            : (nextData.voicePresets.find((preset) => preset.isDefault)?.id ??
              nextData.voicePresets[0]?.id ??
              ""),
        );
      }
    } finally {
      refreshing.current = false;
    }
  }, [projectId]);

  const hasActiveWork = useMemo(
    () =>
      data.progress.pending + data.progress.queued + data.progress.running > 0,
    [data.progress],
  );

  useEffect(() => {
    if (!hasActiveWork) return;
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasActiveWork, refresh]);

  const eligibleScenes = useMemo(
    () => data.scenes.filter((scene) => scene.eligibility === "eligible"),
    [data.scenes],
  );

  const selectionScenes = useMemo(() => {
    const selectable = data.scenes.filter(
      (scene) =>
        selected.has(scene.sceneId) &&
        (scene.eligibility === "eligible" ||
          scene.eligibility === "hasApprovedAudio"),
    );
    return selectable.length > 0 ? selectable : eligibleScenes;
  }, [data.scenes, eligibleScenes, selected]);

  const pendingReviewSceneIds = useMemo(
    () =>
      data.scenes
        .filter(
          (scene) =>
            scene.latestStatus === "succeeded" &&
            scene.latestReviewStatus === "pending" &&
            scene.latestGenerationId !== null,
        )
        .map((scene) => scene.sceneId),
    [data.scenes],
  );

  const approvableGenerationIds = useMemo(
    () =>
      data.scenes
        .filter(
          (scene) =>
            selected.has(scene.sceneId) &&
            scene.latestStatus === "succeeded" &&
            scene.latestReviewStatus === "pending" &&
            scene.latestGenerationId !== null,
        )
        .map((scene) => scene.latestGenerationId as string),
    [data.scenes, selected],
  );

  const selectedVoicePreset =
    data.voicePresets.find((preset) => preset.id === voicePresetId) ??
    data.voicePresets[0] ??
    null;

  const toggleSelect = useCallback((sceneId: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(sceneId);
      else next.delete(sceneId);
      return next;
    });
  }, []);

  const selectAllPendingReview = useCallback(() => {
    setSelected(new Set(pendingReviewSceneIds));
  }, [pendingReviewSceneIds]);

  const handleGenerate = useCallback(
    async (input: AudioGenerateInput): Promise<SceneAudioActionResult> => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("voicePresetId", input.voicePresetId);
      formData.set("requestNonce", crypto.randomUUID());
      input.sceneIds.forEach((id) => formData.append("sceneIds", id));
      const result = await startSceneAudioGenerationAction(formData);
      if (result.success) {
        setSelected(new Set());
        await refresh();
      }
      return result;
    },
    [projectId, refresh],
  );

  const runReview = useCallback(
    async (
      action: (formData: FormData) => Promise<SceneAudioActionResult>,
      generationId: string,
    ): Promise<SceneAudioActionResult> => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("generationId", generationId);
      const result = await action(formData);
      if (result.success) await refresh();
      return result;
    },
    [projectId, refresh],
  );

  const handleApproveSelected =
    useCallback(async (): Promise<SceneAudioActionResult> => {
      let failure: string | null = null;
      for (const generationId of approvableGenerationIds) {
        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("generationId", generationId);
        const result = await approveSceneAudioAction(formData);
        if (!result.success) failure = result.error;
      }
      setSelected(new Set());
      await refresh();
      return { success: failure === null, error: failure };
    }, [approvableGenerationIds, projectId, refresh]);

  const handleCreatePreset = useCallback(
    async (formData: FormData): Promise<SceneAudioActionResult> => {
      formData.set("projectId", projectId);
      const result = await createVoicePresetAction(formData);
      if (result.success) await refresh();
      return result;
    },
    [projectId, refresh],
  );

  if (data.scenes.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <h2 className="font-semibold">No scenes to voice yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Approve a script version and run scene analysis, then approve scenes
          to generate their narration audio and build the project timeline here.
        </p>
      </div>
    );

  return (
    <div className="space-y-5">
      <AudioGenerationProgress
        progress={data.progress}
        timeline={data.timeline}
      />

      <VoicePreviewPanel />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <VoicePresetSelector
          canManage={canManageVoicePresets}
          defaultModel={selectedVoicePreset?.model ?? "gpt-4o-mini-tts"}
          onCreatePreset={handleCreatePreset}
          onSelect={setVoicePresetId}
          selectedVoicePresetId={voicePresetId}
          voicePresets={data.voicePresets}
        />
        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <Button
              onClick={() => setSelected(new Set())}
              size="sm"
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
          ) : null}
          {canReview && pendingReviewSceneIds.length > 0 ? (
            <Button
              onClick={selectAllPendingReview}
              size="sm"
              type="button"
              variant="ghost"
            >
              Select all pending ({pendingReviewSceneIds.length})
            </Button>
          ) : null}
          {canReview ? (
            <ApproveSelectedAudioButton
              count={approvableGenerationIds.length}
              disabled={approvableGenerationIds.length === 0}
              onApproveSelected={handleApproveSelected}
            />
          ) : null}
          {canGenerate && data.configuration.enabled && selectedVoicePreset ? (
            <BulkGenerateAudioButton
              availableBudgetCents={data.availableBudgetCents}
              configuration={data.configuration}
              disabled={selectionScenes.length === 0}
              onGenerate={handleGenerate}
              scenes={selectionScenes}
              voicePresetId={voicePresetId}
              voicePresetName={selectedVoicePreset.name}
            />
          ) : null}
        </div>
      </div>

      <SceneAudioList
        availableBudgetCents={data.availableBudgetCents}
        canGenerate={canGenerate && data.configuration.enabled}
        canReview={canReview}
        configuration={data.configuration}
        onApprove={(generationId) =>
          runReview(approveSceneAudioAction, generationId)
        }
        onCancel={(generationId) =>
          runReview(cancelSceneAudioAction, generationId)
        }
        onGenerate={handleGenerate}
        onReject={(generationId) =>
          runReview(rejectSceneAudioAction, generationId)
        }
        onToggleSelect={toggleSelect}
        scenes={data.scenes}
        selectedSceneIds={selected}
        voicePresetId={voicePresetId}
        voicePresetName={selectedVoicePreset?.name ?? ""}
      />
    </div>
  );
}
