"use client";

import { useState } from "react";
import { RenderPresetSelector } from "@/components/render/RenderPresetSelector";
import { StartRenderButton } from "@/components/render/StartRenderButton";
import { RenderToggleRow } from "@/components/render/RenderToggleRow";
import { formatUsdCents } from "@/lib/format/currency";
import type {
  RenderConfigurationView,
  RenderPresetView,
  StartRenderInput,
} from "@/lib/render/render-view";

export function RenderSettingsForm({
  presets,
  configuration,
  timelineReady,
  canRender,
  availableBudgetCents,
  watermarkAvailable,
  pending,
  onStart,
  selectedOutputVariantId,
  onOutputVariantChange,
}: {
  presets: RenderPresetView[];
  configuration: RenderConfigurationView;
  timelineReady: boolean;
  canRender: boolean;
  availableBudgetCents: number;
  watermarkAvailable: boolean;
  pending: boolean;
  onStart: (input: StartRenderInput) => void;
  selectedOutputVariantId: string;
  onOutputVariantChange: (outputVariantId: string) => void;
}) {
  const selectedPreset =
    presets.find(
      (preset) => preset.outputVariantId === selectedOutputVariantId,
    ) ?? presets[0];
  const [includeCaptions, setIncludeCaptions] = useState(true);
  const [includeWatermark, setIncludeWatermark] = useState(false);

  const overBudget =
    timelineReady && configuration.estimatedCostCents > availableBudgetCents;
  const disabledReason = !canRender
    ? "You do not have permission to render."
    : !configuration.enabled
      ? "Rendering is currently disabled."
      : !timelineReady
        ? "Resolve the timeline issues to enable rendering."
        : !configuration.withinDurationLimit
          ? "The video exceeds the maximum render duration."
          : overBudget
            ? "This render would exceed the available budget."
            : null;

  return (
    <section
      aria-label="Render settings"
      className="space-y-4 rounded-xl border p-4"
    >
      <RenderPresetSelector
        disabled={!canRender || pending}
        onSelect={(presetId) => {
          const preset = presets.find((candidate) => candidate.id === presetId);
          if (preset) onOutputVariantChange(preset.outputVariantId);
        }}
        presets={presets}
        selectedPresetId={selectedPreset?.id ?? ""}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <RenderToggleRow
          checked={includeCaptions}
          description="Burn the reviewed captions into the video."
          disabled={!canRender || pending}
          label="Captions"
          onChange={setIncludeCaptions}
        />
        <RenderToggleRow
          checked={includeWatermark && watermarkAvailable}
          description={
            watermarkAvailable
              ? "Overlay the workspace watermark."
              : "No watermark is configured."
          }
          disabled={!canRender || pending || !watermarkAvailable}
          label="Watermark"
          onChange={setIncludeWatermark}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Estimated cost{" "}
          <span className="font-medium text-foreground">
            {formatUsdCents(configuration.estimatedCostCents)}
          </span>{" "}
          · Budget left{" "}
          <span className="font-medium text-foreground">
            {formatUsdCents(availableBudgetCents)}
          </span>
        </p>
        <StartRenderButton
          disabled={disabledReason !== null}
          estimatedCostCents={configuration.estimatedCostCents}
          onStart={() =>
            onStart({
              presetId: selectedPreset?.id ?? "",
              outputVariantId: selectedOutputVariantId,
              includeCaptions,
              includeWatermark,
            })
          }
          pending={pending}
        />
      </div>

      {disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </section>
  );
}
