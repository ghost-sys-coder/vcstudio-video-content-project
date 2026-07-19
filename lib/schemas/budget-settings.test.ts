import { describe, expect, it } from "vitest";
import {
  budgetFormSchema,
  operationalLimitsFormSchema,
} from "@/lib/schemas/budget-settings";

const workspaceId = "11111111-1111-4111-8111-111111111111";

describe("budgetFormSchema", () => {
  it("converts dollar inputs to integer cents", () => {
    const result = budgetFormSchema.parse({
      workspaceId,
      dailyBudgetDollars: "3.50",
      monthlyBudgetDollars: "50",
      manualConfirmationThresholdDollars: "1.00",
    });
    expect(result.dailyBudgetDollars).toBe(350);
    expect(result.monthlyBudgetDollars).toBe(5000);
    expect(result.manualConfirmationThresholdDollars).toBe(100);
  });

  it("rounds sub-cent precision to the nearest cent", () => {
    const result = budgetFormSchema.parse({
      workspaceId,
      dailyBudgetDollars: "1.006",
      monthlyBudgetDollars: "2",
      manualConfirmationThresholdDollars: "0",
    });
    expect(result.dailyBudgetDollars).toBe(101);
  });

  it("rejects a negative budget", () => {
    expect(() =>
      budgetFormSchema.parse({
        workspaceId,
        dailyBudgetDollars: "-1",
        monthlyBudgetDollars: "2",
        manualConfirmationThresholdDollars: "1",
      }),
    ).toThrow();
  });
});

describe("operationalLimitsFormSchema", () => {
  it("treats blank fields as null (use default)", () => {
    const result = operationalLimitsFormSchema.parse({
      workspaceId,
      maxImagesPerBatch: "",
      maxScenesPerAudioBatch: "",
      maxRenderDurationSeconds: "",
      maxRetryAttempts: "",
    });
    expect(result.maxImagesPerBatch).toBeNull();
    expect(result.maxScenesPerAudioBatch).toBeNull();
    expect(result.maxRenderDurationSeconds).toBeNull();
    expect(result.maxRetryAttempts).toBeNull();
  });

  it("parses provided positive integer overrides", () => {
    const result = operationalLimitsFormSchema.parse({
      workspaceId,
      maxImagesPerBatch: "10",
      maxScenesPerAudioBatch: "15",
      maxRenderDurationSeconds: "600",
      maxRetryAttempts: "0",
    });
    expect(result.maxImagesPerBatch).toBe(10);
    expect(result.maxRenderDurationSeconds).toBe(600);
    expect(result.maxRetryAttempts).toBe(0);
  });

  it("rejects a non-positive batch override", () => {
    expect(() =>
      operationalLimitsFormSchema.parse({
        workspaceId,
        maxImagesPerBatch: "0",
        maxScenesPerAudioBatch: "",
        maxRenderDurationSeconds: "",
        maxRetryAttempts: "",
      }),
    ).toThrow();
  });
});
