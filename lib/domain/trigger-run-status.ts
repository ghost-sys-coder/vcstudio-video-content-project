const activeTriggerRunStatuses = new Set([
  "PENDING_VERSION",
  "WAITING_FOR_DEPLOY",
  "DELAYED",
  "QUEUED",
  "DEQUEUED",
  "EXECUTING",
  "REATTEMPTING",
  "FROZEN",
  "WAITING",
]);

const failedTriggerRunStatuses = new Set([
  "CANCELED",
  "FAILED",
  "CRASHED",
  "INTERRUPTED",
  "SYSTEM_FAILURE",
  "EXPIRED",
  "TIMED_OUT",
]);

export type TriggerRunDisposition = "active" | "completed" | "failed";

export function getTriggerRunDisposition(
  status: string,
): TriggerRunDisposition {
  if (status === "COMPLETED") return "completed";
  if (failedTriggerRunStatuses.has(status)) return "failed";
  if (activeTriggerRunStatuses.has(status)) return "active";
  return "active";
}

export function getTriggerRunFailure(input: { status: string }): {
  category: string;
  message: string;
} {
  const status = input.status.toLowerCase();
  return {
    category: `trigger_${status}`,
    message:
      input.status === "CRASHED"
        ? "The scene-analysis worker crashed before it could complete. You can retry the analysis."
        : "The scene-analysis workflow ended before it could complete. You can retry the analysis.",
  };
}
