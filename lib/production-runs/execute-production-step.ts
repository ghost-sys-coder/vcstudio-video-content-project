import type { ContentPlatform, ProductionRun, Project } from "@/db/schema";
import { classifyStepError } from "@/lib/production-runs/classify-step-error";
import type { GateResult } from "@/lib/production-runs/gates/gate-result";
import {
  planProductionStep,
  type GateReport,
  type ProductionRunFacts,
  type ProductionStep,
} from "@/lib/production-runs/plan-production-step";
import {
  parseProductionRunPolicy,
  type ProductionRunPolicy,
} from "@/lib/production-runs/production-run-policy";
import type { ProductionRunReferences } from "@/lib/production-runs/production-run-references";
import {
  PRODUCTION_RUN_STAGE_LABELS,
  type ProductionRunEventKind,
  type ProductionRunGateSubject,
  type ProductionRunStage,
} from "@/lib/production-runs/production-run-state";
import { decideRunBudget, formatCents } from "@/lib/production-runs/run-budget";

/** Seconds between polls of a stage the run is waiting on. */
export const PRODUCTION_RUN_POLL_SECONDS = 20;
/** Seconds to back off when a rate limit refuses a step. */
export const PRODUCTION_RUN_RATE_LIMIT_WAIT_SECONDS = 90;

export type ProductionStepOutcome =
  | { kind: "continue" }
  | { kind: "wait"; seconds: number; reason: string }
  | {
      kind: "stopped";
      status: "held" | "ready_for_review" | "failed" | "cancelled" | "lost";
    };

/**
 * Everything the executor touches, as functions.
 *
 * The real wiring lives in `production-run-services.ts`; tests pass fakes.
 * Each start function returns the estimate it caused so the run can keep its
 * own ceiling honest, and each one is the same service a creator's click uses.
 */
export interface ProductionRunServices {
  findRun(input: {
    workspaceId: string;
    runId: string;
  }): Promise<ProductionRun | null>;
  findProject(input: {
    workspaceId: string;
    projectId: string;
  }): Promise<Project | null>;
  loadFacts(input: {
    workspaceId: string;
    project: Project;
    run: ProductionRun;
  }): Promise<ProductionRunFacts>;

  startScriptGeneration(input: {
    workspaceId: string;
    project: Project;
    userId: string;
    requestNonce: string;
  }): Promise<{ runId: string; estimatedCostCents: number }>;
  approveScript(input: {
    workspaceId: string;
    projectId: string;
    userId: string;
    content: string;
    draftRevision: number;
  }): Promise<{ versionId: string }>;
  startSceneAnalysis(input: {
    workspaceId: string;
    project: Project;
    userId: string;
  }): Promise<{ analysisRunId: string; estimatedCostCents: number }>;
  approveAllScenes(input: {
    workspaceId: string;
    projectId: string;
  }): Promise<void>;
  estimateImages(input: {
    workspaceId: string;
    project: Project;
    sceneCount: number;
    quality: ProductionRunPolicy["imageQuality"];
  }): Promise<number>;
  startImages(input: {
    workspaceId: string;
    project: Project;
    userId: string;
    sceneIds: string[];
    quality: ProductionRunPolicy["imageQuality"];
    requestNonce: string;
  }): Promise<{
    batchId: string;
    estimatedCostCents: number;
    reservedCount: number;
  }>;
  approveImage(input: {
    workspaceId: string;
    projectId: string;
    generationId: string;
    userId: string;
  }): Promise<void>;
  estimateAudio(input: {
    workspaceId: string;
    project: Project;
    userId: string;
    sceneIds: string[];
    voicePresetId: string;
  }): Promise<number>;
  startAudio(input: {
    workspaceId: string;
    project: Project;
    userId: string;
    sceneIds: string[];
    voicePresetId: string;
    requestNonce: string;
  }): Promise<{ estimatedCostCents: number; reservedCount: number }>;
  approveAudio(input: {
    workspaceId: string;
    projectId: string;
    generationId: string;
    userId: string;
  }): Promise<void>;
  startRender(input: {
    workspaceId: string;
    project: Project;
    userId: string;
    requestNonce: string;
  }): Promise<{ renderId: string; estimatedCostCents: number }>;
  startTitles(input: {
    workspaceId: string;
    project: Project;
    userId: string;
    platform: ContentPlatform;
    requestNonce: string;
  }): Promise<{ runId: string; estimatedCostCents: number }>;
  startThumbnail(input: {
    workspaceId: string;
    project: Project;
    userId: string;
    platform: ContentPlatform;
    requestNonce: string;
  }): Promise<{ thumbnailGenerationId: string; estimatedCostCents: number }>;
  saveReleasePackage(input: {
    workspaceId: string;
    project: Project;
    userId: string;
    platform: ContentPlatform;
  }): Promise<{ releasePackageId: string }>;

  updateCursor(input: {
    workspaceId: string;
    runId: string;
    stage?: ProductionRunStage;
    attempts?: Partial<Record<ProductionRunStage, number>>;
    stageReferences?: ProductionRunReferences;
    spentCostCents?: number;
  }): Promise<ProductionRun | null>;
  hold(input: {
    workspaceId: string;
    runId: string;
    reason: string;
  }): Promise<ProductionRun | null>;
  finish(input: {
    workspaceId: string;
    runId: string;
    status: "ready_for_review" | "failed";
    safeErrorMessage?: string | null;
    stageReferences?: ProductionRunReferences;
  }): Promise<ProductionRun | null>;
  appendEvent(input: {
    workspaceId: string;
    runId: string;
    stage: ProductionRunStage;
    kind: ProductionRunEventKind;
    message: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<void>;
  recordGates(input: {
    workspaceId: string;
    runId: string;
    stage: ProductionRunStage;
    results: Array<{
      subject: ProductionRunGateSubject;
      subjectId: string;
      label: string;
      verdict: GateResult["verdict"];
      score: number | null;
      reasons: string[];
      accepted: boolean;
    }>;
  }): Promise<void>;
  audit(input: {
    workspaceId: string;
    projectId: string;
    actorUserId: string;
    action:
      "production_run_held" | "production_run_ready" | "production_run_failed";
    runId: string;
    metadata?: Record<string, string | number | boolean | null>;
  }): Promise<void>;
  /** A deterministic nonce for this run's N-th attempt at a stage. */
  nonce(input: {
    runId: string;
    stage: ProductionRunStage;
    attempt: number;
  }): string;
}

function gateRows(reports: GateReport[], accepted: boolean) {
  return reports.map((report) => ({
    subject: report.subject,
    subjectId: report.subjectId,
    label: report.label,
    verdict: report.result.verdict,
    score: report.result.score,
    reasons: report.result.reasons,
    accepted,
  }));
}

/**
 * Carries out exactly one planned step and writes what happened.
 *
 * It re-reads the run first and refuses to act unless the run is `running`,
 * so a cancellation that lands between two steps stops the next one. Every
 * paid start increments the stage's attempt count before the call, so a
 * crash after the call cannot produce an unbounded retry.
 */
export async function executeProductionStep(
  services: ProductionRunServices,
  input: { workspaceId: string; runId: string },
): Promise<ProductionStepOutcome> {
  const { workspaceId, runId } = input;
  const run = await services.findRun({ workspaceId, runId });
  if (!run) return { kind: "stopped", status: "lost" };
  if (run.status !== "running")
    return {
      kind: "stopped",
      status:
        run.status === "cancelled"
          ? "cancelled"
          : run.status === "held"
            ? "held"
            : run.status === "failed"
              ? "failed"
              : run.status === "ready_for_review"
                ? "ready_for_review"
                : "lost",
    };

  const loadedProject = await services.findProject({
    workspaceId,
    projectId: run.projectId,
  });
  if (!loadedProject) {
    await services.finish({
      workspaceId,
      runId,
      status: "failed",
      safeErrorMessage: "The project no longer exists.",
    });
    await services.appendEvent({
      workspaceId,
      runId,
      stage: run.stage,
      kind: "failed",
      message: "The project no longer exists.",
    });
    return { kind: "stopped", status: "failed" };
  }
  return executeWithRun(services, {
    workspaceId,
    runId,
    run,
    project: loadedProject,
  });
}

async function executeWithRun(
  services: ProductionRunServices,
  input: {
    workspaceId: string;
    runId: string;
    run: ProductionRun;
    project: Project;
  },
): Promise<ProductionStepOutcome> {
  const { workspaceId, runId, run, project } = input;
  const scope = { workspaceId, projectId: run.projectId };
  const log = (
    kind: ProductionRunEventKind,
    message: string,
    metadata?: Record<string, string | number | boolean | null>,
  ) =>
    services.appendEvent({
      workspaceId,
      runId,
      stage: run.stage,
      kind,
      message,
      metadata,
    });

  const policy = parseProductionRunPolicy(run.policy);
  const facts = await services.loadFacts({ workspaceId, project, run });
  const step = planProductionStep(facts, {
    stage: run.stage,
    attempts: run.attempts,
    policy,
  });
  const userId = run.requestedByUserId;
  const references: ProductionRunReferences = { ...run.stageReferences };
  const attempts = { ...run.attempts };
  const stageLabel = PRODUCTION_RUN_STAGE_LABELS[run.stage];

  const holdRun = async (
    reason: string,
    gates: GateReport[] = [],
  ): Promise<ProductionStepOutcome> => {
    await services.recordGates({
      workspaceId,
      runId,
      stage: run.stage,
      results: gateRows(gates, false),
    });
    const held = await services.hold({ workspaceId, runId, reason });
    if (!held) return { kind: "stopped", status: "lost" };
    await log("held", reason, { gateCount: gates.length });
    await services.audit({
      ...scope,
      actorUserId: userId,
      action: "production_run_held",
      runId,
      metadata: { stage: run.stage, reason },
    });
    return { kind: "stopped", status: "held" };
  };

  const nextAttempt = (): number => {
    const value = (attempts[run.stage] ?? 0) + 1;
    attempts[run.stage] = value;
    return value;
  };

  /** Refuses a paid start that would pass the run's own ceiling. */
  const guardBudget = async (
    estimateCents: number,
    what: string,
  ): Promise<ProductionStepOutcome | null> => {
    const decision = decideRunBudget({
      spentCents: run.spentCostCents,
      estimateCents,
      maximumCents: policy.maximumCostCents,
      what,
    });
    if (decision.allowed) return null;
    await log("budget_refused", decision.reason, {
      estimateCents,
      spentCents: run.spentCostCents,
    });
    return holdRun(
      `${decision.reason} Raise the ceiling on a new run, or finish this stage yourself and resume.`,
    );
  };

  /** Commits attempts, references and spend together after a paid start. */
  const commitStart = async (
    estimateCents: number,
    message: string,
    metadata: Record<string, string | number | boolean | null> = {},
  ) => {
    const spent = run.spentCostCents + Math.max(0, estimateCents);
    await services.updateCursor({
      workspaceId,
      runId,
      attempts,
      stageReferences: references,
      spentCostCents: spent,
    });
    await log(
      attempts[run.stage] && attempts[run.stage]! > 1
        ? "stage_retried"
        : "stage_started",
      message,
      { ...metadata, estimateCents, spentCents: spent },
    );
  };

  try {
    return await executeStep(step);
  } catch (error) {
    const classified = classifyStepError(error);
    if (classified.kind === "wait") {
      // The attempt was counted before the call; a rate-limited start did not
      // reserve anything, so give the count back before waiting.
      await services.updateCursor({
        workspaceId,
        runId,
        attempts: run.attempts,
      });
      return {
        kind: "wait",
        seconds: PRODUCTION_RUN_RATE_LIMIT_WAIT_SECONDS,
        reason: classified.message,
      };
    }
    if (classified.kind === "hold") {
      await services.updateCursor({
        workspaceId,
        runId,
        attempts,
        stageReferences: references,
      });
      return holdRun(`${stageLabel}: ${classified.message}`);
    }
    throw error;
  }

  async function executeStep(
    current: ProductionStep,
  ): Promise<ProductionStepOutcome> {
    switch (current.kind) {
      case "advance": {
        await log("stage_completed", `${stageLabel} is complete.`);
        const moved = await services.updateCursor({
          workspaceId,
          runId,
          stage: current.to,
        });
        if (!moved) return { kind: "stopped", status: "lost" };
        await services.appendEvent({
          workspaceId,
          runId,
          stage: current.to,
          kind: "stage_started",
          message: `Working on ${PRODUCTION_RUN_STAGE_LABELS[current.to].toLowerCase()}.`,
        });
        return { kind: "continue" };
      }
      case "wait":
        return {
          kind: "wait",
          seconds: PRODUCTION_RUN_POLL_SECONDS,
          reason: current.reason,
        };
      case "hold":
        return holdRun(current.reason, current.gates);
      case "fail": {
        await services.finish({
          workspaceId,
          runId,
          status: "failed",
          safeErrorMessage: current.reason,
        });
        await log("failed", current.reason);
        await services.audit({
          ...scope,
          actorUserId: userId,
          action: "production_run_failed",
          runId,
          metadata: { stage: run.stage, reason: current.reason },
        });
        return { kind: "stopped", status: "failed" };
      }
      case "complete": {
        const finished = await services.finish({
          workspaceId,
          runId,
          status: "ready_for_review",
          stageReferences: references,
        });
        if (!finished) return { kind: "stopped", status: "lost" };
        await log(
          "ready_for_review",
          `The release package is ready for your review. This run spent about ${formatCents(run.spentCostCents)}.`,
        );
        await services.audit({
          ...scope,
          actorUserId: userId,
          action: "production_run_ready",
          runId,
          metadata: { spentCents: run.spentCostCents },
        });
        return { kind: "stopped", status: "ready_for_review" };
      }

      case "generate_script": {
        const refused = await guardBudget(0, "Script generation");
        if (refused) return refused;
        const attempt = nextAttempt();
        const started = await services.startScriptGeneration({
          workspaceId,
          project,
          userId,
          requestNonce: services.nonce({ runId, stage: "script", attempt }),
        });
        references.scriptGenerationRunId = started.runId;
        await commitStart(
          started.estimatedCostCents,
          "Writing a script from the brief.",
          { scriptGenerationRunId: started.runId },
        );
        return { kind: "continue" };
      }
      case "approve_script": {
        const approved = await services.approveScript({
          ...scope,
          userId,
          content: current.content,
          draftRevision: current.draftRevision,
        });
        await services.recordGates({
          workspaceId,
          runId,
          stage: run.stage,
          results: gateRows([current.gate], true),
        });
        await log(
          "gate_passed",
          `Approved the script (${current.gate.result.reasons.join(" ") || "checked"}).`,
          {
            scriptVersionId: approved.versionId,
            verdict: current.gate.result.verdict,
          },
        );
        return { kind: "continue" };
      }

      case "analyze_scenes": {
        const refused = await guardBudget(0, "Scene analysis");
        if (refused) return refused;
        nextAttempt();
        const started = await services.startSceneAnalysis({
          workspaceId,
          project,
          userId,
        });
        references.sceneAnalysisRunId = started.analysisRunId;
        await commitStart(
          started.estimatedCostCents,
          "Analysing the script into scenes.",
          { sceneAnalysisRunId: started.analysisRunId },
        );
        return { kind: "continue" };
      }
      case "approve_scenes": {
        await services.approveAllScenes(scope);
        await services.recordGates({
          workspaceId,
          runId,
          stage: run.stage,
          results: gateRows([current.gate], true),
        });
        await log(
          "gate_passed",
          `Approved the scene plan (${current.gate.result.reasons.join(" ") || "checked"}).`,
          { verdict: current.gate.result.verdict },
        );
        return { kind: "continue" };
      }

      case "generate_images": {
        const estimate = await services.estimateImages({
          workspaceId,
          project,
          sceneCount: current.sceneIds.length,
          quality: policy.imageQuality,
        });
        const refused = await guardBudget(
          estimate,
          `Generating ${current.sceneIds.length} image${current.sceneIds.length === 1 ? "" : "s"}`,
        );
        if (refused) return refused;
        const attempt = nextAttempt();
        const started = await services.startImages({
          workspaceId,
          project,
          userId,
          sceneIds: current.sceneIds,
          quality: policy.imageQuality,
          requestNonce: services.nonce({ runId, stage: "images", attempt }),
        });
        references.imageBatchIds = [
          ...(references.imageBatchIds ?? []),
          started.batchId,
        ];
        await commitStart(
          started.estimatedCostCents,
          `Generating ${started.reservedCount} scene image${started.reservedCount === 1 ? "" : "s"}.`,
          { batchId: started.batchId, reservedCount: started.reservedCount },
        );
        if (started.reservedCount === 0)
          return holdRun(
            "No images could be reserved for this batch. Check the project budget and the scenes, then resume.",
          );
        return { kind: "continue" };
      }
      case "approve_images": {
        for (const report of current.approvals)
          await services.approveImage({
            ...scope,
            generationId: report.subjectId,
            userId,
          });
        await services.recordGates({
          workspaceId,
          runId,
          stage: run.stage,
          results: gateRows(current.approvals, true),
        });
        const warned = current.approvals.filter(
          (report) => report.result.verdict === "warn",
        ).length;
        await log(
          "gate_passed",
          `Approved ${current.approvals.length} image${current.approvals.length === 1 ? "" : "s"}${warned ? ` (${warned} with warnings)` : ""}.`,
          { approved: current.approvals.length, warned },
        );
        return { kind: "continue" };
      }

      case "generate_audio": {
        const voicePresetId = facts.audio.voicePresetId;
        if (!voicePresetId)
          return holdRun("No voice preset is available for narration.");
        const estimate = await services.estimateAudio({
          workspaceId,
          project,
          userId,
          sceneIds: current.sceneIds,
          voicePresetId,
        });
        const refused = await guardBudget(
          estimate,
          `Narrating ${current.sceneIds.length} scene${current.sceneIds.length === 1 ? "" : "s"}`,
        );
        if (refused) return refused;
        const attempt = nextAttempt();
        const nonce = services.nonce({ runId, stage: "audio", attempt });
        const started = await services.startAudio({
          workspaceId,
          project,
          userId,
          sceneIds: current.sceneIds,
          voicePresetId,
          requestNonce: nonce,
        });
        references.audioRequestNonces = [
          ...(references.audioRequestNonces ?? []),
          nonce,
        ];
        await commitStart(
          started.estimatedCostCents,
          `Generating narration for ${started.reservedCount} scene${started.reservedCount === 1 ? "" : "s"}.`,
          { reservedCount: started.reservedCount },
        );
        if (started.reservedCount === 0)
          return holdRun(
            "No narration could be reserved. Check the project budget and the scenes, then resume.",
          );
        return { kind: "continue" };
      }
      case "approve_audio": {
        for (const report of current.approvals)
          await services.approveAudio({
            ...scope,
            generationId: report.subjectId,
            userId,
          });
        await services.recordGates({
          workspaceId,
          runId,
          stage: run.stage,
          results: gateRows(current.approvals, true),
        });
        const warned = current.approvals.filter(
          (report) => report.result.verdict === "warn",
        ).length;
        await log(
          "gate_passed",
          `Approved ${current.approvals.length} narration clip${current.approvals.length === 1 ? "" : "s"}${warned ? ` (${warned} with warnings)` : ""}.`,
          { approved: current.approvals.length, warned },
        );
        return { kind: "continue" };
      }

      case "start_render": {
        const refused = await guardBudget(0, "Rendering");
        if (refused) return refused;
        const attempt = nextAttempt();
        const started = await services.startRender({
          workspaceId,
          project,
          userId,
          requestNonce: services.nonce({ runId, stage: "render", attempt }),
        });
        references.renderId = started.renderId;
        await commitStart(started.estimatedCostCents, "Rendering the video.", {
          renderId: started.renderId,
        });
        return { kind: "continue" };
      }

      case "generate_titles": {
        const refused = await guardBudget(0, "Title generation");
        if (refused) return refused;
        const attempt = nextAttempt();
        const started = await services.startTitles({
          workspaceId,
          project,
          userId,
          platform: facts.release.platform,
          requestNonce: services.nonce({ runId, stage: "release", attempt }),
        });
        references.titleGenerationRunId = started.runId;
        await commitStart(
          started.estimatedCostCents,
          "Writing titles, a description and tags.",
          { titleGenerationRunId: started.runId },
        );
        return { kind: "continue" };
      }
      case "generate_thumbnail": {
        const refused = await guardBudget(0, "Thumbnail generation");
        if (refused) return refused;
        const attempt = nextAttempt();
        const started = await services.startThumbnail({
          workspaceId,
          project,
          userId,
          platform: facts.release.platform,
          requestNonce: services.nonce({ runId, stage: "release", attempt }),
        });
        references.thumbnailGenerationId = started.thumbnailGenerationId;
        await commitStart(
          started.estimatedCostCents,
          "Generating a text-free thumbnail.",
          { thumbnailGenerationId: started.thumbnailGenerationId },
        );
        return { kind: "continue" };
      }
      case "save_release_package": {
        const saved = await services.saveReleasePackage({
          workspaceId,
          project,
          userId,
          platform: facts.release.platform,
        });
        references.releasePackageId = saved.releasePackageId;
        await services.updateCursor({
          workspaceId,
          runId,
          stageReferences: references,
        });
        await log(
          "stage_completed",
          "Saved a draft release package with the chosen title, description, tags and thumbnail.",
          { releasePackageId: saved.releasePackageId },
        );
        return { kind: "continue" };
      }
      default: {
        const unreachable: never = current;
        throw new Error(
          `Unknown production step: ${JSON.stringify(unreachable)}`,
        );
      }
    }
  }
}
