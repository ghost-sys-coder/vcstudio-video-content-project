"use client";

import { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AudioGenerationDialog } from "@/components/audio/AudioGenerationDialog";
import { estimateSceneAudioCostCents } from "@/lib/costs/scene-audio-cost";
import type {
  AudioConfigurationView,
  AudioGenerateHandler,
  AudioSceneView,
} from "@/lib/audio/audio-view";

export function RegenerateSceneAudioDialog({
  scene,
  voicePresetId,
  voicePresetName,
  configuration,
  availableBudgetCents,
  disabled,
  onGenerate,
}: {
  scene: AudioSceneView;
  voicePresetId: string;
  voicePresetName: string;
  configuration: AudioConfigurationView;
  availableBudgetCents: number;
  disabled: boolean;
  onGenerate: AudioGenerateHandler;
}) {
  const [open, setOpen] = useState(false);
  const isRetry = scene.latestStatus === "failed";
  const estimatedCostCents = estimateSceneAudioCostCents({
    characterCount: scene.characterCount,
    rates: {
      costPerMillionCharactersCents:
        configuration.costPerMillionCharactersCents,
      minimumEstimateCents: configuration.minimumEstimateCents,
    },
  });

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCwIcon aria-hidden />
        {isRetry ? "Retry" : "Regenerate"}
      </Button>
      <AudioGenerationDialog
        availableBudgetCents={availableBudgetCents}
        confirmLabel="Generate new version"
        description={`Create a new narration version for scene ${scene.sceneNumber}. This starts a new paid generation.`}
        estimatedCostCents={estimatedCostCents}
        maximumScenesPerBatch={configuration.maximumScenesPerBatch}
        onConfirm={() =>
          onGenerate({ sceneIds: [scene.sceneId], voicePresetId })
        }
        onOpenChange={setOpen}
        open={open}
        sceneCount={1}
        title={
          isRetry
            ? `Retry scene ${scene.sceneNumber} audio`
            : `Regenerate scene ${scene.sceneNumber} audio`
        }
        voicePresetName={voicePresetName}
      />
    </>
  );
}
