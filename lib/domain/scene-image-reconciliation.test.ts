import { describe, expect, it } from "vitest";
import { getSceneImageReconciliationDecision } from "@/lib/domain/scene-image-reconciliation";

const activeInput = {
  localStatus: "queued" as const,
  reservationExpired: false,
  providerRequestMayBeBillable: false,
};

describe("getSceneImageReconciliationDecision", () => {
  it("does not change a terminal local generation", () => {
    expect(
      getSceneImageReconciliationDecision({
        ...activeInput,
        localStatus: "succeeded",
        trigger: { kind: "found", status: "CRASHED" },
      }),
    ).toEqual({ action: "none" });
  });

  it("waits for a missing or temporarily unavailable run until expiry", () => {
    expect(
      getSceneImageReconciliationDecision({
        ...activeInput,
        trigger: { kind: "missing" },
      }),
    ).toEqual({ action: "wait" });
    expect(
      getSceneImageReconciliationDecision({
        ...activeInput,
        trigger: { kind: "unavailable" },
      }),
    ).toEqual({ action: "wait" });
  });

  it("fails crashed, cancelled, and completed-mismatch runs", () => {
    for (const status of ["CRASHED", "CANCELED", "SYSTEM_FAILURE"]) {
      expect(
        getSceneImageReconciliationDecision({
          ...activeInput,
          trigger: { kind: "found", status },
        }),
      ).toMatchObject({ action: "fail", reason: "trigger_failed" });
    }
    expect(
      getSceneImageReconciliationDecision({
        ...activeInput,
        trigger: { kind: "found", status: "COMPLETED" },
      }),
    ).toMatchObject({
      action: "fail",
      reason: "trigger_completion_mismatch",
    });
  });

  it("fails an expired active or missing run", () => {
    expect(
      getSceneImageReconciliationDecision({
        ...activeInput,
        reservationExpired: true,
        trigger: { kind: "found", status: "EXECUTING" },
      }),
    ).toMatchObject({ action: "fail", reason: "reservation_expired" });
    expect(
      getSceneImageReconciliationDecision({
        ...activeInput,
        reservationExpired: true,
        trigger: { kind: "missing" },
      }),
    ).toMatchObject({ action: "fail", reason: "trigger_missing" });
  });

  it("syncs an executing run and preserves conservative billing exposure", () => {
    expect(
      getSceneImageReconciliationDecision({
        ...activeInput,
        trigger: { kind: "found", status: "EXECUTING" },
      }),
    ).toEqual({ action: "sync_running" });
    expect(
      getSceneImageReconciliationDecision({
        ...activeInput,
        providerRequestMayBeBillable: true,
        trigger: { kind: "found", status: "CRASHED" },
      }),
    ).toMatchObject({ action: "fail", chargeConservatively: true });
  });
});
