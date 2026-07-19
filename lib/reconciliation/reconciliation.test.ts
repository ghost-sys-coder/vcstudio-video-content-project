import { describe, expect, it } from "vitest";
import { selectStaleRuns } from "@/lib/reconciliation/stale-workflow";
import { selectOrphanAssetCandidates } from "@/lib/reconciliation/orphan-assets";

const ACTIVE = ["pending", "queued", "running"] as const;
const now = new Date("2026-07-19T12:00:00.000Z");

describe("selectStaleRuns", () => {
  it("selects active runs that have not progressed past the cutoff", () => {
    const runs = [
      {
        id: "fresh",
        status: "running",
        updatedAt: new Date("2026-07-19T11:59:00Z"),
      },
      {
        id: "stale",
        status: "running",
        updatedAt: new Date("2026-07-19T11:40:00Z"),
      },
    ];
    const result = selectStaleRuns({
      runs,
      now,
      staleAfterMinutes: 15,
      activeStatuses: ACTIVE,
    });
    expect(result.map((run) => run.id)).toEqual(["stale"]);
  });

  it("ignores terminal runs even when old", () => {
    const runs = [
      {
        id: "done",
        status: "succeeded",
        updatedAt: new Date("2026-07-19T10:00:00Z"),
      },
      {
        id: "failed",
        status: "failed",
        updatedAt: new Date("2026-07-19T10:00:00Z"),
      },
    ];
    expect(
      selectStaleRuns({
        runs,
        now,
        staleAfterMinutes: 15,
        activeStatuses: ACTIVE,
      }),
    ).toEqual([]);
  });

  it("rejects a non-positive threshold", () => {
    expect(() =>
      selectStaleRuns({
        runs: [],
        now,
        staleAfterMinutes: 0,
        activeStatuses: ACTIVE,
      }),
    ).toThrow(RangeError);
  });
});

describe("selectOrphanAssetCandidates", () => {
  it("flags leaked assets and missing assets separately", () => {
    const rows = [
      { id: "leak", status: "failed", hasAsset: true },
      { id: "leak-cancel", status: "cancelled", hasAsset: true },
      { id: "missing", status: "succeeded", hasAsset: false },
      { id: "ok", status: "succeeded", hasAsset: true },
      { id: "clean-fail", status: "failed", hasAsset: false },
    ];
    expect(selectOrphanAssetCandidates(rows)).toEqual({
      leakedAssets: ["leak", "leak-cancel"],
      missingAssets: ["missing"],
    });
  });

  it("returns empty selections for consistent rows", () => {
    expect(
      selectOrphanAssetCandidates([
        { id: "ok", status: "succeeded", hasAsset: true },
        { id: "pending", status: "running", hasAsset: false },
      ]),
    ).toEqual({ leakedAssets: [], missingAssets: [] });
  });
});
