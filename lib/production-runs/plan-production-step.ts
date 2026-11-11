import type { ContentPlatform, SceneStatus } from "@/db/schema";
import { evaluateAudioGate } from "@/lib/production-runs/gates/audio-gate";
import type { GateResult } from "@/lib/production-runs/gates/gate-result";
import { evaluateImageGate } from "@/lib/production-runs/gates/image-gate";
import { evaluateScenePlanGate } from "@/lib/production-runs/gates/scene-plan-gate";
import { evaluateScriptGate } from "@/lib/production-runs/gates/script-gate";
import type { ProductionRunPolicy } from "@/lib/production-runs/production-run-policy";
import {
  PRODUCTION_RUN_STAGE_LABELS,
  type ProductionRunGateSubject,
  type ProductionRunStage,
} from "@/lib/production-runs/production-run-state";

/**
 * Everything the planner is allowed to know. Every field is read from stored
 * rows by the facts loader; nothing here is an opinion.
 */
export interface ProductionRunFacts {
  project: {
    id: string;
    status: string;
    maximumBudgetCents: number;
    channelPlatform: ContentPlatform | null;
  };
  script: {
    approvedVersionId: string | null;
    draft: { content: string; revision: number; updatedAt: Date } | null;
    briefHasTopic: boolean;
    targetDurationSeconds: number | null;
    maximumCharacters: number;
    /** The generation this run started, if any. */
    generation: {
      id: string;
      status: "pending" | "queued" | "running" | "completed" | "failed";
      generatedContent: string | null;
      completedAt: Date | null;
      safeErrorMessage: string | null;
    } | null;
  };
  scenes: {
    /** The analysis this run started, if any. */
    analysis: {
      id: string;
      status: "pending" | "queued" | "running" | "completed" | "failed";
      safeErrorMessage: string | null;
    } | null;
    current: Array<{
      sceneId: string;
      sceneVersionId: string;
      sceneNumber: number;
      status: SceneStatus;
      narrationText: string;
      visualDescription: string;
    }>;
    maximumScenes: number;
  };
  images: {
    targetSize: string;
    perScene: Array<{
      sceneId: string;
      sceneNumber: number;
      latest: {
        id: string;
        status: string;
        reviewStatus: string;
        assetObjectKey: string | null;
        assetWidth: number | null;
        assetHeight: number | null;
        safeErrorMessage: string | null;
      } | null;
    }>;
  };
  audio: {
    voicePresetId: string | null;
    perScene: Array<{
      sceneId: string;
      sceneNumber: number;
      narrationText: string;
      latest: {
        id: string;
        status: string;
        reviewStatus: string;
        assetObjectKey: string | null;
        durationMilliseconds: number | null;
        amplitudeEnvelope: number[] | null;
        safeErrorMessage: string | null;
      } | null;
    }>;
  };
  render: {
    /** The render this run started, if any. */
    own: { id: string; status: string; safeErrorMessage: string | null } | null;
  };
  release: {
    platform: ContentPlatform;
    titles: {
      status: "pending" | "queued" | "running" | "completed" | "failed";
      safeErrorMessage: string | null;
    } | null;
    hasTitleSuggestions: boolean;
    thumbnail: { status: string; safeErrorMessage: string | null } | null;
    hasUsableThumbnail: boolean;
    packageId: string | null;
  };
}

export interface ProductionRunCursor {
  stage: ProductionRunStage;
  /** How many times each stage has started billable work in this run. */
  attempts: Partial<Record<ProductionRunStage, number>>;
  policy: ProductionRunPolicy;
}

export interface GateReport {
  subject: ProductionRunGateSubject;
  subjectId: string;
  label: string;
  result: GateResult;
}

export type ProductionStep =
  | { kind: "generate_script" }
  | {
      kind: "approve_script";
      content: string;
      draftRevision: number;
      gate: GateReport;
    }
  | { kind: "analyze_scenes" }
  | { kind: "approve_scenes"; gate: GateReport }
  | { kind: "generate_images"; sceneIds: string[] }
  | { kind: "approve_images"; approvals: GateReport[] }
  | { kind: "generate_audio"; sceneIds: string[] }
  | { kind: "approve_audio"; approvals: GateReport[] }
  | { kind: "start_render" }
  | { kind: "generate_titles" }
  | { kind: "generate_thumbnail" }
  | { kind: "save_release_package" }
  | { kind: "advance"; to: ProductionRunStage }
  | { kind: "wait"; reason: string }
  | { kind: "hold"; reason: string; gates: GateReport[] }
  | { kind: "fail"; reason: string }
  | { kind: "complete" };

const ACTIVE = new Set(["pending", "queued", "running"]);

/** Scene statuses that mean "a person or the run accepted this scene". */
function isSceneAccepted(status: SceneStatus): boolean {
  return (
    status === "approved" ||
    status === "generating" ||
    status === "generated" ||
    status === "locked"
  );
}

function attemptsFor(cursor: ProductionRunCursor): number {
  return cursor.attempts[cursor.stage] ?? 0;
}

function exhausted(cursor: ProductionRunCursor): boolean {
  return attemptsFor(cursor) >= cursor.policy.maximumStageAttempts;
}

function exhaustedHold(
  cursor: ProductionRunCursor,
  what: string,
): ProductionStep {
  return {
    kind: "hold",
    reason: `${what} failed ${attemptsFor(cursor)} time${attemptsFor(cursor) === 1 ? "" : "s"}; the run will not pay for another attempt on its own.`,
    gates: [],
  };
}

function gatedAcceptance(
  cursor: ProductionRunCursor,
  stage: Exclude<ProductionRunStage, "release">,
  gate: GateReport,
  accept: ProductionStep,
): ProductionStep {
  if (gate.result.verdict === "fail")
    return {
      kind: "hold",
      reason: `${gate.label} did not pass its check.`,
      gates: [gate],
    };
  if (cursor.policy.stages[stage] === "hold")
    return {
      kind: "hold",
      reason: `${PRODUCTION_RUN_STAGE_LABELS[stage]} is set to wait for your approval.`,
      gates: [gate],
    };
  return accept;
}

function planScript(
  facts: ProductionRunFacts,
  cursor: ProductionRunCursor,
): ProductionStep {
  const { script } = facts;
  if (script.approvedVersionId) return { kind: "advance", to: "scenes" };

  const generation = script.generation;
  if (generation && ACTIVE.has(generation.status))
    return { kind: "wait", reason: "Writing the script." };

  // Prefer whichever text is newer: a creator who edited the draft after the
  // run wrote one has made a decision the run must not overwrite.
  const draftHasContent = (script.draft?.content.trim() ?? "") !== "";
  const generated =
    generation?.status === "completed" && generation.generatedContent
      ? generation
      : null;
  const useDraft =
    draftHasContent &&
    (!generated ||
      !generated.completedAt ||
      (script.draft?.updatedAt.getTime() ?? 0) >
        generated.completedAt.getTime());
  const content = useDraft
    ? (script.draft?.content ?? "")
    : (generated?.generatedContent ?? "");

  if (content.trim() !== "") {
    const gate: GateReport = {
      subject: "script",
      subjectId: useDraft ? "draft" : (generated?.id ?? "draft"),
      label: "The script",
      result: evaluateScriptGate({
        content,
        maximumCharacters: script.maximumCharacters,
        targetDurationSeconds: script.targetDurationSeconds,
      }),
    };
    return gatedAcceptance(cursor, "script", gate, {
      kind: "approve_script",
      content,
      draftRevision: script.draft?.revision ?? 0,
      gate,
    });
  }

  if (generation?.status === "failed" && exhausted(cursor))
    return exhaustedHold(cursor, "Script generation");
  if (!script.briefHasTopic)
    return {
      kind: "hold",
      reason:
        "Add a topic to the content brief, or write a script, so the run has something to produce.",
      gates: [],
    };
  if (exhausted(cursor)) return exhaustedHold(cursor, "Script generation");
  return { kind: "generate_script" };
}

function planScenes(
  facts: ProductionRunFacts,
  cursor: ProductionRunCursor,
): ProductionStep {
  if (!facts.script.approvedVersionId)
    return {
      kind: "hold",
      reason: "The approved script is gone. Approve a script before resuming.",
      gates: [],
    };
  const { scenes } = facts;
  if (scenes.current.length > 0) {
    if (scenes.current.every((scene) => isSceneAccepted(scene.status)))
      return { kind: "advance", to: "images" };
    const gate: GateReport = {
      subject: "scene_plan",
      subjectId: scenes.analysis?.id ?? facts.project.id,
      label: "The scene plan",
      result: evaluateScenePlanGate({
        scenes: scenes.current,
        maximumScenes: scenes.maximumScenes,
      }),
    };
    return gatedAcceptance(cursor, "scenes", gate, {
      kind: "approve_scenes",
      gate,
    });
  }
  const analysis = scenes.analysis;
  if (analysis && ACTIVE.has(analysis.status))
    return { kind: "wait", reason: "Analysing the script into scenes." };
  if (analysis?.status === "completed")
    return {
      kind: "hold",
      reason: "The analysis finished but produced no scenes.",
      gates: [],
    };
  if (exhausted(cursor)) return exhaustedHold(cursor, "Scene analysis");
  return { kind: "analyze_scenes" };
}

function planImages(
  facts: ProductionRunFacts,
  cursor: ProductionRunCursor,
): ProductionStep {
  const toGenerate: string[] = [];
  const approvals: GateReport[] = [];
  const holds: GateReport[] = [];
  let waiting = 0;
  for (const scene of facts.images.perScene) {
    const latest = scene.latest;
    if (!latest) {
      toGenerate.push(scene.sceneId);
      continue;
    }
    if (ACTIVE.has(latest.status)) {
      waiting += 1;
      continue;
    }
    if (latest.status === "succeeded" && latest.reviewStatus === "approved")
      continue;
    const gate: GateReport = {
      subject: "scene_image",
      subjectId: latest.id,
      label: `Scene ${scene.sceneNumber}'s image`,
      result: evaluateImageGate({
        status: latest.status,
        requestedSize: facts.images.targetSize,
        assetWidth: latest.assetWidth,
        assetHeight: latest.assetHeight,
        assetObjectKey: latest.assetObjectKey,
        safeErrorMessage: latest.safeErrorMessage,
      }),
    };
    if (latest.status === "succeeded" && latest.reviewStatus === "pending") {
      if (gate.result.verdict === "fail") holds.push(gate);
      else approvals.push(gate);
      continue;
    }
    // Failed, cancelled, or rejected by a person: generate again if allowed.
    toGenerate.push(scene.sceneId);
  }

  if (holds.length)
    return {
      kind: "hold",
      reason: `${holds.length} image${holds.length === 1 ? "" : "s"} did not pass the check.`,
      gates: holds,
    };
  if (approvals.length) {
    if (cursor.policy.stages.images === "hold")
      return {
        kind: "hold",
        reason: "Images are set to wait for your approval.",
        gates: approvals,
      };
    return { kind: "approve_images", approvals };
  }
  if (toGenerate.length) {
    if (exhausted(cursor)) return exhaustedHold(cursor, "Image generation");
    return { kind: "generate_images", sceneIds: toGenerate };
  }
  if (waiting) return { kind: "wait", reason: "Generating scene images." };
  return { kind: "advance", to: "audio" };
}

function planAudio(
  facts: ProductionRunFacts,
  cursor: ProductionRunCursor,
): ProductionStep {
  if (!facts.audio.voicePresetId)
    return {
      kind: "hold",
      reason:
        "Choose a workspace default voice, or a voice for this run, before narration can be generated.",
      gates: [],
    };
  const toGenerate: string[] = [];
  const approvals: GateReport[] = [];
  const holds: GateReport[] = [];
  let waiting = 0;
  for (const scene of facts.audio.perScene) {
    const latest = scene.latest;
    if (!latest) {
      toGenerate.push(scene.sceneId);
      continue;
    }
    if (ACTIVE.has(latest.status)) {
      waiting += 1;
      continue;
    }
    if (latest.status === "succeeded" && latest.reviewStatus === "approved")
      continue;
    const gate: GateReport = {
      subject: "scene_audio",
      subjectId: latest.id,
      label: `Scene ${scene.sceneNumber}'s narration`,
      result: evaluateAudioGate({
        status: latest.status,
        assetObjectKey: latest.assetObjectKey,
        durationMilliseconds: latest.durationMilliseconds,
        narrationText: scene.narrationText,
        amplitudeEnvelope: latest.amplitudeEnvelope,
        safeErrorMessage: latest.safeErrorMessage,
      }),
    };
    if (latest.status === "succeeded" && latest.reviewStatus === "pending") {
      if (gate.result.verdict === "fail") holds.push(gate);
      else approvals.push(gate);
      continue;
    }
    toGenerate.push(scene.sceneId);
  }

  if (holds.length)
    return {
      kind: "hold",
      reason: `${holds.length} narration clip${holds.length === 1 ? "" : "s"} did not pass the check.`,
      gates: holds,
    };
  if (approvals.length) {
    if (cursor.policy.stages.audio === "hold")
      return {
        kind: "hold",
        reason: "Narration is set to wait for your approval.",
        gates: approvals,
      };
    return { kind: "approve_audio", approvals };
  }
  if (toGenerate.length) {
    if (exhausted(cursor)) return exhaustedHold(cursor, "Narration generation");
    return { kind: "generate_audio", sceneIds: toGenerate };
  }
  if (waiting) return { kind: "wait", reason: "Generating narration." };
  return { kind: "advance", to: "render" };
}

function planRender(
  facts: ProductionRunFacts,
  cursor: ProductionRunCursor,
): ProductionStep {
  const own = facts.render.own;
  if (own) {
    if (ACTIVE.has(own.status))
      return { kind: "wait", reason: "Rendering the video." };
    if (own.status === "succeeded") {
      if (cursor.policy.stages.render === "hold")
        return {
          kind: "hold",
          reason: "The render is set to wait for your review.",
          gates: [
            {
              subject: "render",
              subjectId: own.id,
              label: "The render",
              result: { verdict: "pass", score: null, reasons: ["Rendered."] },
            },
          ],
        };
      return { kind: "advance", to: "release" };
    }
    if (exhausted(cursor)) return exhaustedHold(cursor, "Rendering");
    return { kind: "start_render" };
  }
  if (exhausted(cursor)) return exhaustedHold(cursor, "Rendering");
  return { kind: "start_render" };
}

function planRelease(
  facts: ProductionRunFacts,
  cursor: ProductionRunCursor,
): ProductionStep {
  const { release } = facts;
  if (release.packageId) return { kind: "complete" };

  if (release.titles && ACTIVE.has(release.titles.status))
    return { kind: "wait", reason: "Writing titles and a description." };
  if (release.thumbnail && ACTIVE.has(release.thumbnail.status))
    return { kind: "wait", reason: "Generating a thumbnail." };

  if (!release.hasTitleSuggestions) {
    if (release.titles?.status === "failed" && exhausted(cursor))
      return exhaustedHold(cursor, "Title generation");
    if (exhausted(cursor)) return exhaustedHold(cursor, "Release preparation");
    return { kind: "generate_titles" };
  }
  if (!release.hasUsableThumbnail) {
    if (release.thumbnail?.status === "failed" && exhausted(cursor))
      return exhaustedHold(cursor, "Thumbnail generation");
    if (exhausted(cursor)) return exhaustedHold(cursor, "Release preparation");
    return { kind: "generate_thumbnail" };
  }
  return { kind: "save_release_package" };
}

/**
 * Decides the single next thing a run should do, from facts alone.
 *
 * Pure on purpose: the worker loop and the tests call exactly this, so what a
 * run will do in a given situation can be asserted without a database, a
 * provider or a queue. The executor carries out the step and writes the
 * result back; this function never writes anything.
 */
export function planProductionStep(
  facts: ProductionRunFacts,
  cursor: ProductionRunCursor,
): ProductionStep {
  if (facts.project.status === "archived")
    return { kind: "fail", reason: "The project was archived." };
  switch (cursor.stage) {
    case "script":
      return planScript(facts, cursor);
    case "scenes":
      return planScenes(facts, cursor);
    case "images":
      return planImages(facts, cursor);
    case "audio":
      return planAudio(facts, cursor);
    case "render":
      return planRender(facts, cursor);
    case "release":
      return planRelease(facts, cursor);
    default: {
      const unreachable: never = cursor.stage;
      throw new Error(`Unknown production stage: ${String(unreachable)}`);
    }
  }
}
