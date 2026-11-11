/**
 * The vocabulary of a production run.
 *
 * A run is a durable attempt to carry one project from wherever it stands to a
 * release package that a creator reviews. Its status says whether anything is
 * still happening; its stage says what the run is working on. The two are
 * separate on purpose: a held run at the images stage and a running run at the
 * images stage are different situations that the interface must tell apart.
 */

export const PRODUCTION_RUN_STAGES = [
  "script",
  "scenes",
  "images",
  "audio",
  "render",
  "release",
] as const;
export type ProductionRunStage = (typeof PRODUCTION_RUN_STAGES)[number];

export const PRODUCTION_RUN_STATUSES = [
  /** Created and handed to the worker; nothing has executed yet. */
  "queued",
  /** The worker is advancing stages or waiting on a stage it started. */
  "running",
  /** Stopped at a stage that needs a person before it can continue. */
  "held",
  /** Reached the release checkpoint. The run's work is done; a person decides. */
  "ready_for_review",
  /** Stopped because something failed that a retry did not fix. */
  "failed",
  /** Stopped by a person. */
  "cancelled",
] as const;
export type ProductionRunStatus = (typeof PRODUCTION_RUN_STATUSES)[number];

/** Statuses in which the worker still owns the run. */
export const ACTIVE_PRODUCTION_RUN_STATUSES: readonly ProductionRunStatus[] = [
  "queued",
  "running",
];

/** Statuses from which nothing further will ever happen. */
export const TERMINAL_PRODUCTION_RUN_STATUSES: readonly ProductionRunStatus[] =
  ["ready_for_review", "failed", "cancelled"];

export function isActiveProductionRunStatus(
  status: ProductionRunStatus,
): boolean {
  return ACTIVE_PRODUCTION_RUN_STATUSES.includes(status);
}

export function isTerminalProductionRunStatus(
  status: ProductionRunStatus,
): boolean {
  return TERMINAL_PRODUCTION_RUN_STATUSES.includes(status);
}

/** A run that stopped short can be picked up again by a person. */
export function canResumeProductionRun(status: ProductionRunStatus): boolean {
  return status === "held";
}

export function canCancelProductionRun(status: ProductionRunStatus): boolean {
  return status === "queued" || status === "running" || status === "held";
}

export const PRODUCTION_RUN_STATUS_LABELS: Record<ProductionRunStatus, string> =
  {
    queued: "Queued",
    running: "Running",
    held: "Needs you",
    ready_for_review: "Ready for review",
    failed: "Failed",
    cancelled: "Cancelled",
  };

export const PRODUCTION_RUN_STAGE_LABELS: Record<ProductionRunStage, string> = {
  script: "Script",
  scenes: "Scenes",
  images: "Images",
  audio: "Narration",
  render: "Render",
  release: "Release package",
};

export function stageIndex(stage: ProductionRunStage): number {
  return PRODUCTION_RUN_STAGES.indexOf(stage);
}

export function nextProductionRunStage(
  stage: ProductionRunStage,
): ProductionRunStage | null {
  const index = stageIndex(stage);
  return PRODUCTION_RUN_STAGES[index + 1] ?? null;
}

/** The kinds of record a run keeps about what it did. */
export const PRODUCTION_RUN_EVENT_KINDS = [
  "run_started",
  "stage_started",
  "stage_waiting",
  "stage_completed",
  "stage_retried",
  "gate_passed",
  "gate_failed",
  "budget_refused",
  "held",
  "resumed",
  "ready_for_review",
  "failed",
  "cancelled",
] as const;
export type ProductionRunEventKind =
  (typeof PRODUCTION_RUN_EVENT_KINDS)[number];

/** What a gate judged. */
export const PRODUCTION_RUN_GATE_SUBJECTS = [
  "script",
  "scene_plan",
  "scene_image",
  "scene_audio",
  "render",
] as const;
export type ProductionRunGateSubject =
  (typeof PRODUCTION_RUN_GATE_SUBJECTS)[number];

export const GATE_VERDICTS = ["pass", "warn", "fail"] as const;
export type GateVerdict = (typeof GATE_VERDICTS)[number];
