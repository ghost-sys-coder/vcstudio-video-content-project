import {
  differsOnlyByPunctuation,
  normalizeNarrationText,
} from "@/lib/domain/narration-normalization";

/**
 * How many times a scene plan that failed fidelity validation may be sent back
 * to the provider for repair within one analysis run. Each repair is a second
 * billable call, so this is deliberately one: it recovers the common case of a
 * model dropping or merging a passage without turning a bad run into unbounded
 * spend. It is a policy constant rather than an environment variable because it
 * bounds cost, and a deployment should not be able to raise it silently.
 */
export const MAX_SCENE_ANALYSIS_REPAIR_ATTEMPTS = 1;

const EXCERPT_LENGTH = 120;

export type NarrationDiscrepancyKind =
  | "empty_narration"
  | "missing_narration"
  | "duplicated_narration"
  | "reordered_narration"
  | "invented_narration"
  | "uncovered_script_tail";

export interface NarrationDiscrepancy {
  kind: NarrationDiscrepancyKind;
  /** 1-based scene position, or null when the script tail is uncovered. */
  sceneNumber: number | null;
  /** Offset into the normalized approved script where coverage broke down. */
  scriptCharacterOffset: number;
  expectedExcerpt: string;
  receivedExcerpt: string;
  /**
   * True when the only difference is punctuation or symbols. Surfaced, never
   * normalized away, so a creator decides whether it matters.
   */
  punctuationOnly: boolean;
  message: string;
}

export type NarrationCoverageResult =
  | {
      ok: true;
      normalizedScriptLength: number;
      sceneCount: number;
    }
  | {
      ok: false;
      discrepancies: NarrationDiscrepancy[];
      coveredCharacters: number;
      normalizedScriptLength: number;
      summary: string;
    };

function excerpt(value: string, from = 0): string {
  const slice = value.slice(from, from + EXCERPT_LENGTH);
  return value.length > from + EXCERPT_LENGTH ? `${slice}…` : slice;
}

/**
 * Verifies that scene narration, concatenated in scene order, covers the
 * approved script exactly once and in order.
 *
 * Matching is a forward cursor walk rather than a search, which is what makes a
 * legitimately repeated phrase safe: "Let's begin" appearing twice in the
 * script is consumed at two distinct offsets, and only a scene that repeats a
 * passage the script does not repeat is reported as duplicated. Searching for
 * each passage independently would accept a plan that covers the first
 * occurrence twice and the second not at all.
 *
 * The walk stops at the first divergence. After coverage breaks there is no
 * reliable way to resynchronize, and a list of cascading downstream differences
 * would be noise rather than an actionable report.
 */
export function checkNarrationCoverage(input: {
  approvedScript: string;
  sceneNarrations: string[];
}): NarrationCoverageResult {
  const script = normalizeNarrationText(input.approvedScript);
  const parts = input.sceneNarrations.map(normalizeNarrationText);

  const failure = (
    discrepancy: NarrationDiscrepancy,
    coveredCharacters: number,
  ): NarrationCoverageResult => ({
    ok: false,
    discrepancies: [discrepancy],
    coveredCharacters,
    normalizedScriptLength: script.length,
    summary: discrepancy.message,
  });

  let cursor = 0;
  const consumed: string[] = [];

  for (const [index, part] of parts.entries()) {
    const sceneNumber = index + 1;
    if (part.length === 0)
      return failure(
        {
          kind: "empty_narration",
          sceneNumber,
          scriptCharacterOffset: cursor,
          expectedExcerpt: excerpt(script, cursor),
          receivedExcerpt: "",
          punctuationOnly: false,
          message: `Scene ${sceneNumber} has no narration. Every scene must carry the next passage of the approved script.`,
        },
        cursor,
      );

    if (script.startsWith(part, cursor)) {
      cursor += part.length;
      // Scene boundaries fall on whitespace in the approved script; that single
      // separator belongs to neither scene.
      if (script[cursor] === " ") cursor += 1;
      consumed.push(part);
      continue;
    }

    const firstOccurrence = script.indexOf(part);
    const expectedAtCursor = script.slice(cursor, cursor + part.length);
    const punctuationOnly = differsOnlyByPunctuation(expectedAtCursor, part);
    const shared = {
      sceneNumber,
      scriptCharacterOffset: cursor,
      expectedExcerpt: excerpt(script, cursor),
      receivedExcerpt: excerpt(part),
      punctuationOnly,
    };

    if (consumed.includes(part))
      return failure(
        {
          ...shared,
          kind: "duplicated_narration",
          message: `Scene ${sceneNumber} repeats narration an earlier scene already covered. The approved script does not repeat it at character ${cursor}.`,
        },
        cursor,
      );

    if (firstOccurrence >= 0 && firstOccurrence < cursor)
      return failure(
        {
          ...shared,
          kind: "reordered_narration",
          message: `Scene ${sceneNumber} narration belongs earlier in the approved script (character ${firstOccurrence}), but the plan reaches it at character ${cursor}. Scenes are out of order.`,
        },
        cursor,
      );

    if (firstOccurrence > cursor)
      return failure(
        {
          ...shared,
          kind: "missing_narration",
          message: `Scene ${sceneNumber} skips ${firstOccurrence - cursor} characters of the approved script at character ${cursor}. That passage is not covered by any scene.`,
        },
        cursor,
      );

    return failure(
      {
        ...shared,
        kind: "invented_narration",
        message: punctuationOnly
          ? `Scene ${sceneNumber} narration differs from the approved script only in punctuation at character ${cursor}. The narration must be reproduced exactly.`
          : `Scene ${sceneNumber} narration does not appear in the approved script at character ${cursor}.`,
      },
      cursor,
    );
  }

  if (cursor < script.length)
    return failure(
      {
        kind: "uncovered_script_tail",
        sceneNumber: null,
        scriptCharacterOffset: cursor,
        expectedExcerpt: excerpt(script, cursor),
        receivedExcerpt: "",
        punctuationOnly: false,
        message: `The last ${script.length - cursor} characters of the approved script are not covered by any scene.`,
      },
      cursor,
    );

  return {
    ok: true,
    normalizedScriptLength: script.length,
    sceneCount: parts.length,
  };
}
