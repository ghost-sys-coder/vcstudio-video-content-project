"use client";

import { useState } from "react";
import { RenderPresetSelector } from "@/components/render/RenderPresetSelector";
import { StartRenderButton } from "@/components/render/StartRenderButton";
import { formatUsdCents } from "@/lib/format/currency";
import type {
  RenderConfigurationView,
  RenderPresetView,
  StartRenderInput,
} from "@/lib/render/render-view";

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border p-3">
      <input
        checked={checked}
        className="mt-0.5 size-4 accent-primary"
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

export function RenderSettingsForm({
  presets,
  configuration,
  timelineReady,
  canRender,
  availableBudgetCents,
  watermarkAvailable,
  pending,
  onStart,
}: {
  presets: RenderPresetView[];
  configuration: RenderConfigurationView;
  timelineReady: boolean;
  canRender: boolean;
  availableBudgetCents: number;
  watermarkAvailable: boolean;
  pending: boolean;
  onStart: (input: StartRenderInput) => void;
}) {
  const projectPreset =
    presets.find((preset) => preset.isProjectDefault) ?? presets[0];
  const [presetId, setPresetId] = useState(projectPreset?.id ?? "");
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
        onSelect={setPresetId}
        presets={presets}
        selectedPresetId={presetId}
      />

      <div className="grid gap-2 sm:grid-cols-2">
        <ToggleRow
          checked={includeCaptions}
          description="Burn the reviewed captions into the video."
          disabled={!canRender || pending}
          label="Captions"
          onChange={setIncludeCaptions}
        />
        <ToggleRow
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
            onStart({ presetId, includeCaptions, includeWatermark })
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
