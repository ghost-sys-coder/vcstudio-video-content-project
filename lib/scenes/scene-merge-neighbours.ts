/**
 * The scenes a given scene may be merged with, and what to show about them.
 *
 * Only immediate neighbours qualify. That is not a simplification for the
 * interface's benefit — it is the rule that keeps the approved script narrated
 * once and in order, so it belongs here rather than being re-derived wherever a
 * list of options is drawn.
 */

const PREVIEW_LENGTH = 120;

export interface SceneMergeNeighbour {
  sceneId: string;
  sceneNumber: number;
  narrationPreview: string;
  /** True when this neighbour has approved images worth keeping. */
  hasApprovedImages: boolean;
  /** True when anything at all was generated for it. */
  hasGeneratedWork: boolean;
}

export interface SceneMergeCandidateRow {
  sceneId: string;
  sceneNumber: number;
  narrationText: string;
  hasApprovedImages: boolean;
  hasGeneratedWork: boolean;
}

function preview(value: string): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed.length > PREVIEW_LENGTH
    ? `${collapsed.slice(0, PREVIEW_LENGTH)}…`
    : collapsed;
}

export function findSceneMergeNeighbours(input: {
  sceneNumber: number;
  rows: SceneMergeCandidateRow[];
}): SceneMergeNeighbour[] {
  return input.rows
    .filter((row) => Math.abs(row.sceneNumber - input.sceneNumber) === 1)
    .sort((left, right) => left.sceneNumber - right.sceneNumber)
    .map((row) => ({
      sceneId: row.sceneId,
      sceneNumber: row.sceneNumber,
      narrationPreview: preview(row.narrationText),
      hasApprovedImages: row.hasApprovedImages,
      hasGeneratedWork: row.hasGeneratedWork,
    }));
}
