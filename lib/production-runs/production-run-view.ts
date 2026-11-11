import "server-only";

import type { ProductionRun } from "@/db/schema";
import {
  findLatestProductionRun,
  listProductionRunEvents,
  listProductionRunGateResults,
} from "@/db/repositories/production-runs.repository";
import { getProductionRunEnvironment } from "@/lib/env/server";
import { parseProductionRunPolicy } from "@/lib/production-runs/production-run-policy";
import {
  canCancelProductionRun,
  canResumeProductionRun,
  isActiveProductionRunStatus,
  PRODUCTION_RUN_STAGE_LABELS,
  PRODUCTION_RUN_STAGES,
  PRODUCTION_RUN_STATUS_LABELS,
  stageIndex,
  type GateVerdict,
  type ProductionRunStage,
  type ProductionRunStatus,
} from "@/lib/production-runs/production-run-state";

export interface ProductionRunStageView {
  stage: ProductionRunStage;
  label: string;
  state: "done" | "current" | "upcoming";
  mode: "auto" | "hold" | "review";
  attempts: number;
}

export interface ProductionRunEventView {
  id: string;
  stageLabel: string;
  kind: string;
  message: string;
  at: string;
}

export interface ProductionRunGateView {
  id: string;
  stageLabel: string;
  label: string;
  verdict: GateVerdict;
  score: number | null;
  reasons: string[];
  accepted: boolean;
}

export interface ProductionRunView {
  id: string;
  status: ProductionRunStatus;
  statusLabel: string;
  stage: ProductionRunStage;
  stageLabel: string;
  active: boolean;
  canCancel: boolean;
  canResume: boolean;
  holdReason: string | null;
  safeErrorMessage: string | null;
  spentCostCents: number;
  maximumCostCents: number;
  imageQuality: string;
  stages: ProductionRunStageView[];
  events: ProductionRunEventView[];
  gates: ProductionRunGateView[];
  gateSummary: { passed: number; warned: number; failed: number };
  startedAt: string | null;
  completedAt: string | null;
}

export interface ProductionRunPanelView {
  enabled: boolean;
  defaultMaximumCostCents: number;
  run: ProductionRunView | null;
}

function describeStages(run: ProductionRun): ProductionRunStageView[] {
  const policy = parseProductionRunPolicy(run.policy);
  const current = stageIndex(run.stage);
  const finished =
    run.status === "ready_for_review" ? PRODUCTION_RUN_STAGES.length : current;
  return PRODUCTION_RUN_STAGES.map((stage, index) => ({
    stage,
    label: PRODUCTION_RUN_STAGE_LABELS[stage],
    state:
      index < finished ? "done" : index === current ? "current" : "upcoming",
    mode: stage === "release" ? "review" : policy.stages[stage],
    attempts: run.attempts[stage] ?? 0,
  }));
}

/** Projects a run row and its history into what the panel renders. */
export function describeProductionRun(input: {
  run: ProductionRun;
  events: Array<{
    id: string;
    stage: ProductionRunStage;
    kind: string;
    message: string;
    createdAt: Date;
  }>;
  gates: Array<{
    id: string;
    stage: ProductionRunStage;
    label: string;
    verdict: string;
    score: number | null;
    reasons: string[];
    accepted: boolean;
  }>;
}): ProductionRunView {
  const { run } = input;
  const policy = parseProductionRunPolicy(run.policy);
  const gates: ProductionRunGateView[] = input.gates.map((gate) => ({
    id: gate.id,
    stageLabel: PRODUCTION_RUN_STAGE_LABELS[gate.stage],
    label: gate.label,
    verdict: gate.verdict as GateVerdict,
    score: gate.score,
    reasons: gate.reasons,
    accepted: gate.accepted,
  }));
  return {
    id: run.id,
    status: run.status,
    statusLabel: PRODUCTION_RUN_STATUS_LABELS[run.status],
    stage: run.stage,
    stageLabel: PRODUCTION_RUN_STAGE_LABELS[run.stage],
    active: isActiveProductionRunStatus(run.status),
    canCancel: canCancelProductionRun(run.status),
    canResume: canResumeProductionRun(run.status),
    holdReason: run.holdReason,
    safeErrorMessage: run.safeErrorMessage,
    spentCostCents: run.spentCostCents,
    maximumCostCents: policy.maximumCostCents,
    imageQuality: policy.imageQuality,
    stages: describeStages(run),
    events: input.events
      .slice(-40)
      .reverse()
      .map((event) => ({
        id: event.id,
        stageLabel: PRODUCTION_RUN_STAGE_LABELS[event.stage],
        kind: event.kind,
        message: event.message,
        at: event.createdAt.toISOString(),
      })),
    gates,
    gateSummary: {
      passed: gates.filter((gate) => gate.verdict === "pass").length,
      warned: gates.filter((gate) => gate.verdict === "warn").length,
      failed: gates.filter((gate) => gate.verdict === "fail").length,
    },
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

export async function loadProductionRunPanel(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ProductionRunPanelView> {
  const environment = getProductionRunEnvironment();
  const run = await findLatestProductionRun(input);
  if (!run)
    return {
      enabled: environment.ENABLE_PRODUCTION_RUNS,
      defaultMaximumCostCents:
        environment.PRODUCTION_RUN_DEFAULT_MAX_COST_CENTS,
      run: null,
    };
  const [events, gates] = await Promise.all([
    listProductionRunEvents({ workspaceId: input.workspaceId, runId: run.id }),
    listProductionRunGateResults({
      workspaceId: input.workspaceId,
      runId: run.id,
    }),
  ]);
  return {
    enabled: environment.ENABLE_PRODUCTION_RUNS,
    defaultMaximumCostCents: environment.PRODUCTION_RUN_DEFAULT_MAX_COST_CENTS,
    run: describeProductionRun({ run, events, gates }),
  };
}
