import { describe, expect, it } from "vitest";
import {
  addImageGenerationStatusToCounts,
  deriveSceneImageBatchDisplayStatus,
  EMPTY_SCENE_IMAGE_BATCH_COUNTS,
  isSceneImageBatchComplete,
} from "@/lib/domain/bulk-scene-image";

function countsFrom(
  statuses: Array<
    "pending" | "queued" | "running" | "succeeded" | "failed" | "cancelled"
  >,
) {
  return statuses.reduce(
    (counts, status) => addImageGenerationStatusToCounts(counts, status),
    EMPTY_SCENE_IMAGE_BATCH_COUNTS,
  );
}

describe("scene image batch counts", () => {
  it("accumulates each generation status", () => {
    const counts = countsFrom([
      "succeeded",
      "succeeded",
      "failed",
      "running",
      "queued",
    ]);
    expect(counts).toMatchObject({
      total: 5,
      succeeded: 2,
      failed: 1,
      running: 1,
      queued: 1,
      pending: 0,
      cancelled: 0,
    });
  });
});

describe("deriveSceneImageBatchDisplayStatus", () => {
  it("reports pending before any children exist", () => {
    expect(
      deriveSceneImageBatchDisplayStatus({
        storedStatus: "pending",
        counts: EMPTY_SCENE_IMAGE_BATCH_COUNTS,
      }),
    ).toBe("pending");
  });

  it("reports processing while any child is active", () => {
    expect(
      deriveSceneImageBatchDisplayStatus({
        storedStatus: "processing",
        counts: countsFrom(["succeeded", "running"]),
      }),
    ).toBe("processing");
  });

  it("stays processing when cancelled but children are still running", () => {
    expect(
      deriveSceneImageBatchDisplayStatus({
        storedStatus: "cancelled",
        counts: countsFrom(["running", "cancelled"]),
      }),
    ).toBe("processing");
  });

  it("reports completed when every child succeeded", () => {
    expect(
      deriveSceneImageBatchDisplayStatus({
        storedStatus: "processing",
        counts: countsFrom(["succeeded", "succeeded"]),
      }),
    ).toBe("completed");
  });

  it("reports completedWithErrors on partial failure", () => {
    expect(
      deriveSceneImageBatchDisplayStatus({
        storedStatus: "processing",
        counts: countsFrom(["succeeded", "failed"]),
      }),
    ).toBe("completedWithErrors");
  });

  it("reports cancelled when cancelled and no child is active", () => {
    expect(
      deriveSceneImageBatchDisplayStatus({
        storedStatus: "cancelled",
        counts: countsFrom(["succeeded", "cancelled"]),
      }),
    ).toBe("cancelled");
  });

  it("reports cancelled when cancelled with only cancelled children", () => {
    expect(
      deriveSceneImageBatchDisplayStatus({
        storedStatus: "cancelled",
        counts: countsFrom(["cancelled", "cancelled"]),
      }),
    ).toBe("cancelled");
  });
});

describe("isSceneImageBatchComplete", () => {
  it("is false while active children remain", () => {
    expect(isSceneImageBatchComplete(countsFrom(["running"]))).toBe(false);
  });

  it("is true once all children are terminal", () => {
    expect(isSceneImageBatchComplete(countsFrom(["succeeded", "failed"]))).toBe(
      true,
    );
  });

  it("is false with no children", () => {
    expect(isSceneImageBatchComplete(EMPTY_SCENE_IMAGE_BATCH_COUNTS)).toBe(
      false,
    );
  });
});
