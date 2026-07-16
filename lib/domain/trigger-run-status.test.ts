import { describe, expect, it } from "vitest";
import {
  getTriggerRunDisposition,
  getTriggerRunFailure,
} from "@/lib/domain/trigger-run-status";

describe("Trigger run status", () => {
  it("keeps queued and executing runs active", () => {
    expect(getTriggerRunDisposition("QUEUED")).toBe("active");
    expect(getTriggerRunDisposition("EXECUTING")).toBe("active");
    expect(getTriggerRunDisposition("REATTEMPTING")).toBe("active");
  });

  it("recognizes every terminal failure class used by reconciliation", () => {
    for (const status of [
      "CANCELED",
      "FAILED",
      "CRASHED",
      "INTERRUPTED",
      "SYSTEM_FAILURE",
      "EXPIRED",
      "TIMED_OUT",
    ]) {
      expect(getTriggerRunDisposition(status)).toBe("failed");
    }
  });

  it("provides a safe crash message", () => {
    expect(getTriggerRunFailure({ status: "CRASHED" })).toEqual({
      category: "trigger_crashed",
      message:
        "The scene-analysis worker crashed before it could complete. You can retry the analysis.",
    });
  });
});
