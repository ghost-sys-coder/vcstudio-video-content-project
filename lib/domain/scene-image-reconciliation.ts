import { getTriggerRunDisposition } from "@/lib/domain/trigger-run-status";

type LocalImageGenerationStatus =
  "pending" | "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type SceneImageTriggerObservation =
  | { kind: "missing" }
  | { kind: "unavailable" }
  | { kind: "found"; status: string };

export type SceneImageReconciliationDecision =
  | { action: "none" }
  | { action: "wait" }
  | { action: "sync_running" }
  | {
      action: "fail";
      reason:
        | "trigger_missing"
        | "trigger_unavailable"
        | "trigger_failed"
        | "trigger_completion_mismatch"
        | "reservation_expired";
      chargeConservatively: boolean;
    };

export function getSceneImageReconciliationDecision(input: {
  localStatus: LocalImageGenerationStatus;
  reservationExpired: boolean;
  trigger: SceneImageTriggerObservation;
  providerRequestMayBeBillable: boolean;
}): SceneImageReconciliationDecision {
  if (
    input.localStatus === "succeeded" ||
    input.localStatus === "failed" ||
    input.localStatus === "cancelled"
  )
    return { action: "none" };

  if (input.trigger.kind === "missing")
    return input.reservationExpired
      ? {
          action: "fail",
          reason: "trigger_missing",
          chargeConservatively: input.providerRequestMayBeBillable,
        }
      : { action: "wait" };

  if (input.trigger.kind === "unavailable")
    return input.reservationExpired
      ? {
          action: "fail",
          reason: "trigger_unavailable",
          chargeConservatively: input.providerRequestMayBeBillable,
        }
      : { action: "wait" };

  const disposition = getTriggerRunDisposition(input.trigger.status);
  if (disposition === "failed")
    return {
      action: "fail",
      reason: "trigger_failed",
      chargeConservatively: input.providerRequestMayBeBillable,
    };
  if (disposition === "completed")
    return {
      action: "fail",
      reason: "trigger_completion_mismatch",
      chargeConservatively: input.providerRequestMayBeBillable,
    };
  if (input.reservationExpired)
    return {
      action: "fail",
      reason: "reservation_expired",
      chargeConservatively: input.providerRequestMayBeBillable,
    };
  if (input.trigger.status === "EXECUTING") return { action: "sync_running" };
  return { action: "wait" };
}
