import { describe, expect, it } from "vitest";
import {
  countInherited,
  resolveFormatInheritance,
  type FormatInheritableValues,
} from "@/lib/formats/format-inheritance";

const PRESET: FormatInheritableValues = {
  aspectRatio: "16:9",
  framesPerSecond: 30,
  targetDurationSeconds: 600,
  maximumBudgetCents: 5000,
  captionsEnabled: true,
  voicePresetId: "voice-1",
  stylePresetId: "style-1",
};

function find(
  rows: ReturnType<typeof resolveFormatInheritance>,
  field: keyof FormatInheritableValues,
) {
  return rows.find((row) => row.field === field);
}

describe("resolveFormatInheritance", () => {
  it("marks every matching value as inherited", () => {
    const rows = resolveFormatInheritance({
      preset: PRESET,
      effective: { ...PRESET },
    });
    expect(rows.every((row) => row.origin === "inherited")).toBe(true);
    expect(countInherited(rows)).toEqual({ inherited: 7, overridden: 0 });
  });

  it("marks a changed value as overridden and shows both values", () => {
    const rows = resolveFormatInheritance({
      preset: PRESET,
      effective: { ...PRESET, maximumBudgetCents: 9000 },
    });
    const budget = find(rows, "maximumBudgetCents");
    expect(budget?.origin).toBe("overridden");
    expect(budget?.presetValue).toBe("5000");
    expect(budget?.effectiveValue).toBe("9000");
    expect(countInherited(rows)).toEqual({ inherited: 6, overridden: 1 });
  });

  it("treats everything as the creator's own when there is no preset", () => {
    const rows = resolveFormatInheritance({
      preset: null,
      effective: { ...PRESET },
    });
    expect(rows.every((row) => row.origin === "overridden")).toBe(true);
    expect(rows.every((row) => row.presetValue === null)).toBe(true);
  });

  it("reports an unset value rather than pretending it was inherited", () => {
    const rows = resolveFormatInheritance({
      preset: PRESET,
      effective: { ...PRESET, targetDurationSeconds: null },
    });
    expect(find(rows, "targetDurationSeconds")?.origin).toBe("unset");
  });

  it("does not call a value inherited when the preset leaves it unset", () => {
    const rows = resolveFormatInheritance({
      preset: { ...PRESET, voicePresetId: null },
      effective: { ...PRESET, voicePresetId: "voice-9" },
    });
    expect(find(rows, "voicePresetId")?.origin).toBe("overridden");
  });

  it("renders a boolean override readably", () => {
    const rows = resolveFormatInheritance({
      preset: PRESET,
      effective: { ...PRESET, captionsEnabled: false },
    });
    const captions = find(rows, "captionsEnabled");
    expect(captions?.origin).toBe("overridden");
    expect(captions?.presetValue).toBe("on");
    expect(captions?.effectiveValue).toBe("off");
  });

  it("does not confuse a false value with an unset one", () => {
    const rows = resolveFormatInheritance({
      preset: { ...PRESET, captionsEnabled: false },
      effective: { ...PRESET, captionsEnabled: false },
    });
    expect(find(rows, "captionsEnabled")?.origin).toBe("inherited");
  });

  it("does not confuse a zero budget with an unset one", () => {
    const rows = resolveFormatInheritance({
      preset: { ...PRESET, maximumBudgetCents: 0 },
      effective: { ...PRESET, maximumBudgetCents: 0 },
    });
    expect(find(rows, "maximumBudgetCents")?.origin).toBe("inherited");
  });

  it("covers every inheritable field exactly once", () => {
    const rows = resolveFormatInheritance({
      preset: PRESET,
      effective: PRESET,
    });
    expect(new Set(rows.map((row) => row.field)).size).toBe(rows.length);
    expect(rows).toHaveLength(7);
  });
});
