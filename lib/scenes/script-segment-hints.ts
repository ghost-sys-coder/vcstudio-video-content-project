import type { SceneAnalysisSegmentHint } from "@studio/prompts";
import {
  parseScriptStructure,
  type ScriptSegment,
  type ScriptStructure,
} from "@/lib/domain/script-structure";

/**
 * Turns a creator's own script structure into the form the scene-analysis
 * prompt understands.
 *
 * Only a script that both shows structure and gives every segment something to
 * say produces hints. A segment with no narration cannot be honoured as a
 * scene, because narration is what the fidelity check compares and what the
 * narrator reads; handing the model an empty one would guarantee a rejection.
 * In that case the hints are withheld and analysis falls back to its ordinary
 * behaviour on the extracted narration, which is still an improvement on
 * feeding it the production direction.
 */
export function toSceneAnalysisSegmentHints(
  structure: ScriptStructure,
): SceneAnalysisSegmentHint[] {
  if (!structure.isStructured || !structure.hasSegmentHeadings) return [];
  if (structure.segments.some((segment) => segment.narration.trim() === ""))
    return [];
  return structure.segments.map((segment) => ({
    number: segment.number,
    title: segment.title,
    timecodeLabel: segment.timecode?.raw ?? null,
    narration: segment.narration,
    direction: describeDirection(segment),
  }));
}

/** The creator's non-spoken direction, labelled so the model can use it. */
function describeDirection(segment: ScriptSegment): string {
  return segment.directives
    .filter((directive) => directive.text.trim() !== "")
    .map((directive) => `${directive.marker}: ${directive.text}`)
    .join("\n");
}

export interface ScriptAnalysisInput {
  /** The spoken text, which is what analysis segments and validates against. */
  narration: string;
  /** The creator's own segments, empty when they did not state any. */
  segments: SceneAnalysisSegmentHint[];
  structure: ScriptStructure;
}

/**
 * The single place scene analysis decides what a stored script actually means.
 *
 * Both the request path and the worker call this on the same stored content, so
 * they always agree on the narration the plan is held to without needing to
 * pass anything extra between them.
 */
export function readScriptForAnalysis(content: string): ScriptAnalysisInput {
  const structure = parseScriptStructure(content);
  return {
    narration: structure.narration,
    segments: toSceneAnalysisSegmentHints(structure),
    structure,
  };
}
