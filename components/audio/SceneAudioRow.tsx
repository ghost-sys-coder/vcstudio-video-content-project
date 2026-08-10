"use client";

import { GenerateSceneAudioButton } from "@/components/audio/GenerateSceneAudioButton";
import { RegenerateSceneAudioDialog } from "@/components/audio/RegenerateSceneAudioDialog";
import { SceneAudioRecordDialog } from "@/components/audio/SceneAudioRecordDialog";
import { ApproveSceneAudioButton } from "@/components/audio/ApproveSceneAudioButton";
import { CancelSceneAudioButton } from "@/components/audio/CancelSceneAudioButton";
import { AudioDurationDisplay } from "@/components/audio/AudioDurationDisplay";
import { AudioErrorState } from "@/components/audio/AudioErrorState";
import { SceneAudioPlayer } from "@/components/audio/SceneAudioPlayer";
import type {
  AudioConfigurationView,
  AudioGenerateHandler,
  AudioReviewHandler,
  AudioSceneView,
} from "@/lib/audio/audio-view";
import { cn } from "@/lib/utils";

const ELIGIBILITY_LABEL: Record<AudioSceneView["eligibility"], string> = {
  eligible: "Ready",
  hasApprovedAudio: "Approved",
  inProgress: "Generating",
  notApproved: "Scene not approved",
  noNarration: "No narration",
};

export function SceneAudioRow({
  projectId,
  scene,
  selected,
  onToggleSelect,
  canGenerate,
  canReview,
  voicePresetId,
  voicePresetName,
  configuration,
  availableBudgetCents,
  onGenerate,
  onApprove,
  onReject,
  onCancel,
  onRecorded,
}: {
  projectId: string;
  scene: AudioSceneView;
  selected: boolean;
  onToggleSelect: (sceneId: string, checked: boolean) => void;
  canGenerate: boolean;
  canReview: boolean;
  voicePresetId: string;
  voicePresetName: string;
  configuration: AudioConfigurationView;
  availableBudgetCents: number;
  onGenerate: AudioGenerateHandler;
  onApprove: AudioReviewHandler;
  onReject: AudioReviewHandler;
  onCancel: AudioReviewHandler;
  onRecorded: () => Promise<void>;
}) {
  const selectable =
    scene.eligibility === "eligible" ||
    scene.eligibility === "hasApprovedAudio";
  const needsReview =
    scene.latestStatus === "succeeded" &&
    scene.latestReviewStatus === "pending" &&
    (scene.inspectionStatus === null || scene.inspectionStatus === "succeeded");
  const isFailed = scene.latestStatus === "failed";
  const inProgress =
    scene.latestStatus === "pending" ||
    scene.latestStatus === "queued" ||
    scene.latestStatus === "running";
  // Only not-yet-started generations can be safely cancelled; a running
  // provider call is left to finish and reconcile.
  const cancellable =
    scene.latestStatus === "pending" || scene.latestStatus === "queued";

  return (
    <article
      className={cn(
        "space-y-3 rounded-xl bg-card p-4 ring-1 transition",
        selected ? "ring-2 ring-primary" : "ring-foreground/10",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <input
            aria-label={`Select scene ${scene.sceneNumber}`}
            checked={selected}
            className="mt-1 size-4 accent-primary disabled:opacity-40"
            disabled={!selectable || !canGenerate}
            onChange={(event) =>
              onToggleSelect(scene.sceneId, event.target.checked)
            }
            type="checkbox"
          />
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-muted-foreground">
              Scene {scene.sceneNumber}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-foreground/90">
              {scene.narrationPreview || "No narration."}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
            scene.eligibility === "hasApprovedAudio" &&
              "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300",
            scene.eligibility === "eligible" &&
              "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300",
            scene.eligibility === "inProgress" &&
              "bg-primary/10 text-primary ring-primary/20",
            (scene.eligibility === "notApproved" ||
              scene.eligibility === "noNarration") &&
              "bg-muted text-muted-foreground ring-foreground/15",
          )}
        >
          {ELIGIBILITY_LABEL[scene.eligibility]}
        </span>
      </div>

      {scene.audioUrl ? (
        <div className="flex flex-wrap items-center gap-3">
          <SceneAudioPlayer
            label={`Scene ${scene.sceneNumber} narration`}
            src={scene.audioUrl}
          />
          <AudioDurationDisplay
            durationMilliseconds={scene.durationMilliseconds}
          />
        </div>
      ) : null}

      {isFailed ? (
        <AudioErrorState safeErrorMessage={scene.safeErrorMessage} />
      ) : null}

      {scene.inspectionStatus === "pending" ||
      scene.inspectionStatus === "running" ? (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Inspecting the recording before review and animated-character
          lip-sync.
        </p>
      ) : null}
      {scene.inspectionError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {scene.inspectionError}
        </p>
      ) : null}
      {scene.inspectionWarnings.length > 0 ? (
        <ul className="list-disc space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 pl-8 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {scene.inspectionWarnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {needsReview && canReview && scene.latestGenerationId ? (
          <ApproveSceneAudioButton
            generationId={scene.latestGenerationId}
            onApprove={onApprove}
            onReject={onReject}
            reviewStatus={scene.latestReviewStatus ?? "pending"}
          />
        ) : null}
        {canGenerate && cancellable && scene.latestGenerationId ? (
          <CancelSceneAudioButton
            generationId={scene.latestGenerationId}
            onCancel={onCancel}
          />
        ) : null}
        {canGenerate && !inProgress ? (
          scene.eligibility === "eligible" ? (
            <GenerateSceneAudioButton
              availableBudgetCents={availableBudgetCents}
              configuration={configuration}
              disabled={false}
              onGenerate={onGenerate}
              scene={scene}
              voicePresetId={voicePresetId}
              voicePresetName={voicePresetName}
            />
          ) : scene.eligibility === "hasApprovedAudio" || isFailed ? (
            <RegenerateSceneAudioDialog
              availableBudgetCents={availableBudgetCents}
              configuration={configuration}
              disabled={false}
              onGenerate={onGenerate}
              scene={scene}
              voicePresetId={voicePresetId}
              voicePresetName={voicePresetName}
            />
          ) : null
        ) : null}
        {canGenerate &&
        !inProgress &&
        (scene.eligibility === "eligible" ||
          scene.eligibility === "hasApprovedAudio") ? (
          <SceneAudioRecordDialog
            disabled={false}
            onRecorded={onRecorded}
            projectId={projectId}
            scene={scene}
          />
        ) : null}
      </div>
    </article>
  );
}
