import {
  checkNarrationCoverage,
  type NarrationDiscrepancy,
} from "@/lib/domain/narration-coverage";
import { normalizeNarrationText } from "@/lib/domain/narration-normalization";

export type ScriptCoverageStatus =
  "no_script" | "no_scenes" | "covered" | "diverged";

export interface ScriptCoverageSceneRow {
  sceneNumber: number;
  narrationPreview: string;
  /** True for the scene where coverage first broke down. */
  divergent: boolean;
}

export interface ScriptCoverageView {
  status: ScriptCoverageStatus;
  scriptVersionNumber: number | null;
  sceneCount: number;
  coveredCharacters: number;
  scriptCharacters: number;
  coveragePercent: number;
  discrepancies: NarrationDiscrepancy[];
  summary: string;
  scenes: ScriptCoverageSceneRow[];
}

const PREVIEW_LENGTH = 160;

function preview(value: string): string {
  const normalized = normalizeNarrationText(value);
  return normalized.length > PREVIEW_LENGTH
    ? `${normalized.slice(0, PREVIEW_LENGTH)}…`
    : normalized;
}

/**
 * Builds the review comparison between the approved script and the scene
 * narration a creator is actually looking at.
 *
 * Recomputed from current scene versions rather than read back from the
 * analysis run: scenes are editable after analysis, so a stored verdict would
 * describe a plan that no longer exists. This keeps the panel honest about the
 * present state and needs no additional persistence.
 */
export function buildScriptCoverageView(input: {
  approvedScript: string | null;
  scriptVersionNumber: number | null;
  sceneNarrations: string[];
}): ScriptCoverageView {
  const scriptCharacters = input.approvedScript
    ? normalizeNarrationText(input.approvedScript).length
    : 0;
  const scenes: ScriptCoverageSceneRow[] = input.sceneNarrations.map(
    (narrationText, index) => ({
      sceneNumber: index + 1,
      narrationPreview: preview(narrationText),
      divergent: false,
    }),
  );
  const base = {
    scriptVersionNumber: input.scriptVersionNumber,
    sceneCount: input.sceneNarrations.length,
    scriptCharacters,
    discrepancies: [] as NarrationDiscrepancy[],
    scenes,
  };

  if (!input.approvedScript || scriptCharacters === 0)
    return {
      ...base,
      status: "no_script",
      coveredCharacters: 0,
      coveragePercent: 0,
      summary: "No approved script is available to compare against.",
    };
  if (input.sceneNarrations.length === 0)
    return {
      ...base,
      status: "no_scenes",
      coveredCharacters: 0,
      coveragePercent: 0,
      summary: "No scenes have been generated for this script yet.",
    };

  const result = checkNarrationCoverage({
    approvedScript: input.approvedScript,
    sceneNarrations: input.sceneNarrations,
  });
  if (result.ok)
    return {
      ...base,
      status: "covered",
      coveredCharacters: scriptCharacters,
      coveragePercent: 100,
      summary:
        "Scene narration reproduces the approved script exactly once, in order.",
    };

  const divergentSceneNumber = result.discrepancies[0]?.sceneNumber ?? null;
  return {
    ...base,
    status: "diverged",
    discrepancies: result.discrepancies,
    coveredCharacters: result.coveredCharacters,
    coveragePercent: Math.floor(
      (result.coveredCharacters / result.normalizedScriptLength) * 100,
    ),
    summary: result.summary,
    scenes: scenes.map((scene) => ({
      ...scene,
      divergent: scene.sceneNumber === divergentSceneNumber,
    })),
  };
}
