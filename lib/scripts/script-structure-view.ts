import {
  parseScriptStructure,
  type ScriptDirectiveKind,
} from "@/lib/domain/script-structure";

export interface ScriptStructureRow {
  number: number;
  label: string;
  /** A short preview of what will be spoken in this segment. */
  narrationPreview: string;
  /** The markers whose text is excluded here, e.g. "VISUAL, TEXT OVERLAY". */
  excludedHere: string;
  /** True when this segment has nothing spoken, which needs the creator's eye. */
  silent: boolean;
}

export interface ScriptStructureView {
  /** Null when the script carries no direction, so the panel stays hidden. */
  detected: boolean;
  segmentCount: number;
  rows: ScriptStructureRow[];
  excludedMarkers: string[];
  unrecognizedMarkers: string[];
  excludedCharacterCount: number;
  /** True when direction was found but the creator gave no segment headings. */
  directionOnly: boolean;
  /** True when something was excluded that the vocabulary did not recognise. */
  needsReview: boolean;
}

const PREVIEW_LENGTH = 90;

function preview(value: string): string {
  const single = value.replace(/\s+/gu, " ").trim();
  return single.length <= PREVIEW_LENGTH
    ? single
    : `${single.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
}

const KIND_ORDER: ScriptDirectiveKind[] = [
  "visual",
  "overlay",
  "audio",
  "unknown",
  "narration",
];

/**
 * Describes what the system read in a pasted script, for the creator to check.
 *
 * Removing text from narration silently would be the wrong trade even when the
 * removal is correct, so everything excluded is named here and the creator can
 * see it beside their own segments.
 */
export function buildScriptStructureView(content: string): ScriptStructureView {
  const structure = parseScriptStructure(content);
  if (!structure.isStructured)
    return {
      detected: false,
      segmentCount: 0,
      rows: [],
      excludedMarkers: [],
      unrecognizedMarkers: [],
      excludedCharacterCount: 0,
      directionOnly: false,
      needsReview: false,
    };

  const rows = structure.segments.map((segment) => {
    const markers = [...segment.directives]
      .sort(
        (left, right) =>
          KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind),
      )
      .map((directive) => directive.marker);
    return {
      number: segment.number,
      label:
        segment.title ||
        (segment.timecode ? segment.timecode.raw : `Section ${segment.number}`),
      narrationPreview: preview(segment.narration),
      excludedHere: [...new Set(markers)].join(", "),
      silent: segment.narration.trim() === "",
    };
  });

  return {
    detected: true,
    segmentCount: structure.segments.length,
    rows,
    excludedMarkers: structure.excludedMarkers,
    unrecognizedMarkers: structure.unrecognizedMarkers,
    excludedCharacterCount: structure.excludedCharacterCount,
    directionOnly: !structure.hasSegmentHeadings,
    needsReview:
      structure.unrecognizedMarkers.length > 0 ||
      structure.segments.some((segment) => segment.narration.trim() === ""),
  };
}
