import { describe, expect, it } from "vitest";
import {
  budgetSettingsSchema,
  requiresManualConfirmation,
  resolveEffectiveBudget,
  resolveEffectiveLimits,
  type BudgetSettingsRow,
} from "@/lib/budgets/budget-settings";

const defaults = {
  dailyBudgetCents: 500,
  monthlyBudgetCents: 5000,
  manualConfirmationThresholdCents: 100,
};

const limitDefaults = {
  maxImagesPerBatch: 25,
  maxScenesPerAudioBatch: 25,
  maxRenderDurationSeconds: 900,
  maxRetryAttempts: 2,
};

const fullRow: BudgetSettingsRow = {
  dailyBudgetCents: 300,
  monthlyBudgetCents: 4000,
  manualConfirmationThresholdCents: 250,
  maxImagesPerBatch: 10,
  maxScenesPerAudioBatch: null,
  maxRenderDurationSeconds: null,
  maxRetryAttempts: 0,
};

describe("resolveEffectiveBudget", () => {
  it("uses environment defaults when no row exists", () => {
    expect(resolveEffectiveBudget(null, defaults)).toEqual(defaults);
  });

  it("prefers the persisted workspace budgets", () => {
    expect(resolveEffectiveBudget(fullRow, defaults)).toEqual({
      dailyBudgetCents: 300,
      monthlyBudgetCents: 4000,
      manualConfirmationThresholdCents: 250,
    });
  });
});

describe("resolveEffectiveLimits", () => {
  it("falls back to defaults for null overrides and honors set overrides", () => {
    expect(resolveEffectiveLimits(fullRow, limitDefaults)).toEqual({
      maxImagesPerBatch: 10,
      maxScenesPerAudioBatch: 25,
      maxRenderDurationSeconds: 900,
      maxRetryAttempts: 0,
    });
  });

  it("uses all defaults when no row exists", () => {
    expect(resolveEffectiveLimits(null, limitDefaults)).toEqual(limitDefaults);
  });
});

describe("requiresManualConfirmation", () => {
  it("requires confirmation at or above the threshold", () => {
    expect(requiresManualConfirmation(100, 100)).toBe(true);
    expect(requiresManualConfirmation(101, 100)).toBe(true);
  });

  it("does not require confirmation below the threshold", () => {
    expect(requiresManualConfirmation(99, 100)).toBe(false);
  });

  it("treats a zero threshold as always-confirm", () => {
    expect(requiresManualConfirmation(0, 0)).toBe(true);
  });

  it("rejects non-integer or negative input", () => {
    expect(() => requiresManualConfirmation(1.5, 100)).toThrow(RangeError);
    expect(() => requiresManualConfirmation(100, -1)).toThrow(RangeError);
  });
});

describe("budgetSettingsSchema", () => {
  const valid = {
    dailyBudgetCents: 500,
    monthlyBudgetCents: 5000,
    manualConfirmationThresholdCents: 100,
    maxImagesPerBatch: null,
    maxScenesPerAudioBatch: null,
    maxRenderDurationSeconds: null,
    maxRetryAttempts: null,
  };

  it("accepts a valid configuration", () => {
    expect(budgetSettingsSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a daily budget above the monthly budget", () => {
    expect(() =>
      budgetSettingsSchema.parse({ ...valid, dailyBudgetCents: 6000 }),
    ).toThrow();
  });

  it("rejects a non-positive operational override", () => {
    expect(() =>
      budgetSettingsSchema.parse({ ...valid, maxImagesPerBatch: 0 }),
    ).toThrow();
  });

  it("rejects fractional currency values", () => {
    expect(() =>
      budgetSettingsSchema.parse({ ...valid, dailyBudgetCents: 12.5 }),
    ).toThrow();
  });
});
