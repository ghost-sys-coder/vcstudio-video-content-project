type Reservation = {
  workspaceId: string;
  projectId: string;
  analysisRunId: string;
  status: "pending" | "reconciled" | "released";
  reservedCostCents: number;
  expiresAt: Date;
};

type AnalysisRun = {
  id: string;
  workspaceId: string;
  projectId: string;
  estimatedCostCents: number;
  requestFingerprint: string;
};

export type SceneAnalysisPreflightResult =
  | { ok: true }
  | {
      ok: false;
      category:
        | "reservation_missing"
        | "reservation_scope_mismatch"
        | "reservation_not_pending"
        | "reservation_expired"
        | "reservation_amount_mismatch"
        | "request_fingerprint_mismatch";
      message: string;
    };

export function validateSceneAnalysisPreflight(input: {
  run: AnalysisRun;
  reservation: Reservation | null;
  expectedFingerprint: string;
  now: Date;
}): SceneAnalysisPreflightResult {
  const { run, reservation } = input;
  if (!reservation)
    return {
      ok: false,
      category: "reservation_missing",
      message: "The analysis budget reservation is unavailable.",
    };
  if (
    reservation.workspaceId !== run.workspaceId ||
    reservation.projectId !== run.projectId ||
    reservation.analysisRunId !== run.id
  )
    return {
      ok: false,
      category: "reservation_scope_mismatch",
      message: "The analysis budget reservation is invalid.",
    };
  if (reservation.status !== "pending")
    return {
      ok: false,
      category: "reservation_not_pending",
      message: "The analysis budget reservation is no longer pending.",
    };
  if (reservation.expiresAt.getTime() <= input.now.getTime())
    return {
      ok: false,
      category: "reservation_expired",
      message: "The analysis budget reservation has expired.",
    };
  if (reservation.reservedCostCents !== run.estimatedCostCents)
    return {
      ok: false,
      category: "reservation_amount_mismatch",
      message: "The analysis budget reservation amount is invalid.",
    };
  if (run.requestFingerprint !== input.expectedFingerprint)
    return {
      ok: false,
      category: "request_fingerprint_mismatch",
      message: "The analysis request changed after confirmation.",
    };
  return { ok: true };
}
