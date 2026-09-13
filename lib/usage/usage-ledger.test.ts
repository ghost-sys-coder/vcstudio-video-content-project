import {
  usageOperationTypeEnum,
  usageReservationStatusEnum,
} from "@/db/schema";
import { describe, expect, it } from "vitest";
import {
  committedCents,
  USAGE_OPERATION_LABELS,
  USAGE_OPERATION_PROVIDERS,
  USAGE_STATUS_LABELS,
} from "@/lib/usage/usage-ledger";

describe("committedCents", () => {
  it("uses the reserved estimate while pending", () => {
    expect(
      committedCents({
        status: "pending",
        reservedCostCents: 40,
        actualCostCents: null,
      }),
    ).toBe(40);
  });

  it("uses the actual cost once reconciled", () => {
    expect(
      committedCents({
        status: "reconciled",
        reservedCostCents: 40,
        actualCostCents: 33,
      }),
    ).toBe(33);
  });

  it("commits nothing once released", () => {
    expect(
      committedCents({
        status: "released",
        reservedCostCents: 40,
        actualCostCents: 0,
      }),
    ).toBe(0);
  });
});

describe("label maps", () => {
  it("labels every operation the database can record", () => {
    // Derived from the enum rather than counted, so adding an operation fails
    // here with the name of what is missing instead of an off-by-one on a
    // number nobody can interpret.
    for (const operation of usageOperationTypeEnum.enumValues) {
      expect(USAGE_OPERATION_LABELS[operation]).toBeTruthy();
      expect(USAGE_OPERATION_PROVIDERS[operation]).toBeTruthy();
    }
  });

  it("labels every reservation status", () => {
    for (const status of usageReservationStatusEnum.enumValues)
      expect(USAGE_STATUS_LABELS[status]).toBeTruthy();
  });
});
