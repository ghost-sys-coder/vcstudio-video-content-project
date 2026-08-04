import { describe, expect, it } from "vitest";

import { marketingOperationEnum, marketingRunStatusEnum } from "@/db/schema";
import {
  MARKETING_OPERATION_LABELS,
  MARKETING_OPERATION_PROVIDERS,
  MARKETING_RUN_STATUS_LABELS,
  marketingOperationLabel,
} from "@/lib/usage/marketing-usage-ledger";

describe("marketing usage labels", () => {
  it("labels every operation the enum can hold", () => {
    // A missing label renders as a blank cell in the usage table, which turns
    // an attributable charge into an unexplained one.
    for (const operation of marketingOperationEnum.enumValues)
      expect(MARKETING_OPERATION_LABELS[operation]).toBeTruthy();
  });

  it("names a provider for every operation", () => {
    for (const operation of marketingOperationEnum.enumValues)
      expect(MARKETING_OPERATION_PROVIDERS[operation]).toBeTruthy();
  });

  it("labels every run status", () => {
    for (const status of marketingRunStatusEnum.enumValues)
      expect(MARKETING_RUN_STATUS_LABELS[status]).toBeTruthy();
  });

  it("distinguishes a reserved run from a settled one", () => {
    expect(MARKETING_RUN_STATUS_LABELS.pending).not.toBe(
      MARKETING_RUN_STATUS_LABELS.succeeded,
    );
  });
});

describe("marketingOperationLabel", () => {
  it("resolves a known operation", () => {
    expect(marketingOperationLabel("document_summary")).toBe(
      "Document summary",
    );
  });

  it("falls back to the raw value for an operation it does not know", () => {
    // A migration can land ahead of a deploy; the number must stay attributable.
    expect(marketingOperationLabel("future_operation")).toBe(
      "future_operation",
    );
  });
});
