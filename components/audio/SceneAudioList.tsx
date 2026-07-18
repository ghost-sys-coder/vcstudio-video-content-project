"use client";

import { SceneAudioRow } from "@/components/audio/SceneAudioRow";
import type {
  AudioConfigurationView,
  AudioGenerateHandler,
  AudioReviewHandler,
  AudioSceneView,
} from "@/lib/audio/audio-view";

export function SceneAudioList({
  scenes,
  selectedSceneIds,
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
}: {
  scenes: AudioSceneView[];
  selectedSceneIds: ReadonlySet<string>;
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
}) {
  return (
    <div className="space-y-3">
      {scenes.map((scene) => (
        <SceneAudioRow
          availableBudgetCents={availableBudgetCents}
          canGenerate={canGenerate}
          canReview={canReview}
          configuration={configuration}
          key={scene.sceneId}
          onApprove={onApprove}
          onCancel={onCancel}
          onGenerate={onGenerate}
          onReject={onReject}
          onToggleSelect={onToggleSelect}
          scene={scene}
          selected={selectedSceneIds.has(scene.sceneId)}
          voicePresetId={voicePresetId}
          voicePresetName={voicePresetName}
        />
      ))}
    </div>
  );
}
