import { describe, expect, it } from "vitest";
import {
  committedCents,
  USAGE_OPERATION_LABELS,
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
  it("covers every operation and status", () => {
    expect(Object.keys(USAGE_OPERATION_LABELS)).toHaveLength(7);
    expect(Object.keys(USAGE_STATUS_LABELS)).toHaveLength(3);
  });
});
