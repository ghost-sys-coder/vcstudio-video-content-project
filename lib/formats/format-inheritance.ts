/**
 * Works out which of a new project's settings came from a format preset and
 * which the creator changed.
 *
 * The acceptance requirement is that a creator can *see* what was inherited
 * versus overridden. That is only honest if it is computed by comparing the
 * submitted values against the exact preset version the project was created
 * from, rather than assuming everything unspecified was inherited.
 */

export type FormatFieldOrigin = "inherited" | "overridden" | "unset";

export interface FormatInheritableValues {
  aspectRatio: string | null;
  framesPerSecond: number | null;
  targetDurationSeconds: number | null;
  maximumBudgetCents: number | null;
  captionsEnabled: boolean | null;
  voicePresetId: string | null;
  stylePresetId: string | null;
}

export interface FormatFieldResolution {
  field: keyof FormatInheritableValues;
  label: string;
  origin: FormatFieldOrigin;
  presetValue: string | null;
  effectiveValue: string | null;
}

const LABELS: Record<keyof FormatInheritableValues, string> = {
  aspectRatio: "Aspect ratio",
  framesPerSecond: "Frame rate",
  targetDurationSeconds: "Target duration",
  maximumBudgetCents: "Maximum budget",
  captionsEnabled: "Captions",
  voicePresetId: "Voice preset",
  stylePresetId: "Style preset",
};

const FIELDS = Object.keys(LABELS) as (keyof FormatInheritableValues)[];

function display(value: string | number | boolean | null): string | null {
  if (value === null) return null;
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}

/**
 * `preset` is null when the project was created without a format, in which case
 * nothing can be inherited and every set value is the creator's own.
 */
export function resolveFormatInheritance(input: {
  preset: FormatInheritableValues | null;
  effective: FormatInheritableValues;
}): FormatFieldResolution[] {
  return FIELDS.map((field) => {
    const presetValue = input.preset ? input.preset[field] : null;
    const effectiveValue = input.effective[field];
    const origin: FormatFieldOrigin =
      effectiveValue === null || effectiveValue === undefined
        ? "unset"
        : presetValue !== null &&
            presetValue !== undefined &&
            presetValue === effectiveValue
          ? "inherited"
          : "overridden";
    return {
      field,
      label: LABELS[field],
      origin,
      presetValue: display(presetValue),
      effectiveValue: display(effectiveValue),
    };
  });
}

export function countInherited(resolutions: FormatFieldResolution[]): {
  inherited: number;
  overridden: number;
} {
  return {
    inherited: resolutions.filter((row) => row.origin === "inherited").length,
    overridden: resolutions.filter((row) => row.origin === "overridden").length,
  };
}
