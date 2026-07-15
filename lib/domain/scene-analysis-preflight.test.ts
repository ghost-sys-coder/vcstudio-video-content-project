import { describe, expect, it } from "vitest";
import { validateSceneAnalysisPreflight } from "@/lib/domain/scene-analysis-preflight";

const now = new Date("2026-07-16T00:00:00.000Z");
const run = {
  id: "run-1",
  workspaceId: "workspace-1",
  projectId: "project-1",
  estimatedCostCents: 4,
  requestFingerprint: "fingerprint",
};
const reservation = {
  workspaceId: run.workspaceId,
  projectId: run.projectId,
  analysisRunId: run.id,
  status: "pending" as const,
  reservedCostCents: run.estimatedCostCents,
  expiresAt: new Date("2026-07-16T00:30:00.000Z"),
};

describe("validateSceneAnalysisPreflight", () => {
  it("accepts an intact pending reservation", () => {
    expect(
      validateSceneAnalysisPreflight({
        run,
        reservation,
        expectedFingerprint: "fingerprint",
        now,
      }),
    ).toEqual({ ok: true });
  });

  it.each([
    ["missing", null, "reservation_missing"],
    [
      "released",
      { ...reservation, status: "released" as const },
      "reservation_not_pending",
    ],
    [
      "reconciled",
      { ...reservation, status: "reconciled" as const },
      "reservation_not_pending",
    ],
    ["expired", { ...reservation, expiresAt: now }, "reservation_expired"],
    [
      "cross-workspace",
      { ...reservation, workspaceId: "workspace-2" },
      "reservation_scope_mismatch",
    ],
    [
      "wrong amount",
      { ...reservation, reservedCostCents: 3 },
      "reservation_amount_mismatch",
    ],
  ])("rejects a %s reservation", (_label, candidate, category) => {
    const result = validateSceneAnalysisPreflight({
      run,
      reservation: candidate,
      expectedFingerprint: "fingerprint",
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe(category);
  });

  it("rejects a changed prompt fingerprint", () => {
    const result = validateSceneAnalysisPreflight({
      run,
      reservation,
      expectedFingerprint: "different",
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.category).toBe("request_fingerprint_mismatch");
  });
});
