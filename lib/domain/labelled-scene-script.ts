import { parseEmphasisList } from "@/lib/audio/voice-direction";
import type {
  ScriptDirective,
  ScriptSegment,
  ScriptStructure,
} from "@/lib/domain/script-structure";

/**
 * Reads a script laid out as labelled scenes:
 *
 *   Scene 01: The Invisible System Drain
 *   Timestamp: 0:00 - 0:30 (30 sec)
 *   Tone Directive: Curious, tense, intriguing
 *   Pacing Guidance: Deliberate, building suspense
 *   Key Vocal Emphasis: 40 hours a week, poorer, missing piece
 *
 *   NARRATION SCRIPT:
 *
 *   "You work 40 hours a week... [PAUSE: 0.5s] Yet every single year..."
 *
 * The bracket reader cannot see this shape — none of its labels are
 * bracketed — so before this existed the whole document, headings and "Tone
 * Directive" lines included, was treated as narration and would have been read
 * aloud. Here each labelled line is direction, and only what follows is
 * spoken.
 *
 * The shape is only claimed when a document has at least two scene headings;
 * anything less is left to the ordinary reader, so a script that merely
 * mentions "Scene 1:" in a sentence is never reinterpreted.
 */

const SCENE_HEADING =
  /^\s*(?:#{1,6}\s*)?(?:\*\*)?\s*(?:scene|segment)\s+(\d{1,3})\s*(?:[:.)\-–—]\s*(.*?))?\s*(?:\*\*)?\s*$/iu;

const LABELLED_LINE =
  /^\s*(?:[-*•]\s*)?(?:\*\*)?([A-Za-z][A-Za-z /&-]{0,40}?)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.*)$/u;

const MARKDOWN_HEADING = /^\s*#{1,6}\s/u;

type LabelRole =
  | "timecode"
  | "tone"
  | "pacing"
  | "emphasis"
  | "narration"
  | "visual"
  | "overlay"
  | "audio";

const LABEL_ROLES: Record<string, LabelRole> = {
  timestamp: "timecode",
  timecode: "timecode",
  time: "timecode",
  "tone directive": "tone",
  "tone direction": "tone",
  "voice tone": "tone",
  "delivery tone": "tone",
  tone: "tone",
  delivery: "tone",
  "pacing guidance": "pacing",
  "pacing direction": "pacing",
  pacing: "pacing",
  pace: "pacing",
  "key vocal emphasis": "emphasis",
  "vocal emphasis": "emphasis",
  emphasis: "emphasis",
  "narration script": "narration",
  narration: "narration",
  voiceover: "narration",
  "voice over": "narration",
  vo: "narration",
  script: "narration",
  visual: "visual",
  visuals: "visual",
  "visual direction": "visual",
  "b-roll": "visual",
  "on screen": "overlay",
  "on-screen text": "overlay",
  "text overlay": "overlay",
  music: "audio",
  sfx: "audio",
  "sound effects": "audio",
};

function roleOf(label: string): LabelRole | null {
  return LABEL_ROLES[label.trim().toLowerCase().replace(/\s+/gu, " ")] ?? null;
}

/** `0:00 - 0:30 (30 sec)` → `0:00 - 0:30`, which the timecode reader knows. */
function timecodeText(value: string): string {
  return value.replace(/\([^)]*\)/gu, "").trim();
}

/** One pair of quotation marks around the whole narration is layout, not speech. */
function unquote(text: string): string {
  const trimmed = text.trim();
  const match = /^["“]([\s\S]*)["”]$/u.exec(trimmed);
  return match?.[1] !== undefined && !/["“”]/u.test(match[1])
    ? match[1].trim()
    : trimmed;
}

interface DraftSegment {
  number: number;
  title: string;
  timecodeRaw: string | null;
  narrationLines: string[];
  narrating: boolean;
  directives: ScriptDirective[];
  tone: string;
  pacing: string;
  emphasis: string[];
}

export interface LabelledSceneVoice {
  tone: string;
  pacing: string;
  emphasis: string[];
}

export type LabelledScriptSegment = ScriptSegment & {
  voice: LabelledSceneVoice;
};

/**
 * Returns the script's structure, or null when the document is not written
 * this way. `parseTimecode` is passed in so this module and the bracket reader
 * share one definition of a timecode.
 */
export function parseLabelledSceneScript(
  content: string,
  parseTimecode: (
    label: string,
  ) => ScriptStructure["segments"][number]["timecode"],
): (ScriptStructure & { segments: LabelledScriptSegment[] }) | null {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const headingCount = lines.filter((line) => SCENE_HEADING.test(line)).length;
  if (headingCount < 2) return null;

  const drafts: DraftSegment[] = [];
  const preamble: string[] = [];
  let excludedCharacterCount = 0;
  const excluded = new Set<string>();
  let current: DraftSegment | null = null;

  for (const line of lines) {
    const heading = SCENE_HEADING.exec(line);
    if (heading) {
      current = {
        number: drafts.length + 1,
        title: (heading[2] ?? "").trim(),
        timecodeRaw: null,
        narrationLines: [],
        narrating: false,
        directives: [],
        tone: "",
        pacing: "",
        emphasis: [],
      };
      drafts.push(current);
      excludedCharacterCount += line.length;
      continue;
    }

    if (!current) {
      // Before the first scene: a document title is not spoken, anything
      // else is kept rather than silently dropped.
      if (MARKDOWN_HEADING.test(line)) excludedCharacterCount += line.length;
      else preamble.push(line);
      continue;
    }

    if (!current.narrating) {
      if (line.trim() === "") continue;
      const labelled = LABELLED_LINE.exec(line);
      const role = labelled ? roleOf(labelled[1] ?? "") : null;
      if (labelled && role) {
        const label = (labelled[1] ?? "").trim();
        const value = (labelled[2] ?? "").trim();
        excluded.add(label);
        excludedCharacterCount += line.length;
        if (role === "narration") {
          current.narrating = true;
          if (value) current.narrationLines.push(value);
          continue;
        }
        if (role === "timecode") current.timecodeRaw = timecodeText(value);
        if (role === "tone") current.tone = value;
        if (role === "pacing") current.pacing = value;
        if (role === "emphasis") current.emphasis = parseEmphasisList(value);
        current.directives.push({
          marker: label,
          kind:
            role === "visual" || role === "overlay" || role === "audio"
              ? role
              : "unknown",
          text: value,
        });
        continue;
      }
      // Anything that is not a recognised label is where speech begins.
      current.narrating = true;
    }
    if (MARKDOWN_HEADING.test(line)) {
      excludedCharacterCount += line.length;
      continue;
    }
    current.narrationLines.push(line);
  }

  const segments: LabelledScriptSegment[] = drafts.map((draft) => ({
    number: draft.number,
    title: draft.title,
    timecode: draft.timecodeRaw ? parseTimecode(draft.timecodeRaw) : null,
    narration: unquote(
      draft.narrationLines
        .join("\n")
        .replace(/\n{3,}/gu, "\n\n")
        .trim(),
    ),
    directives: draft.directives,
    voice: { tone: draft.tone, pacing: draft.pacing, emphasis: draft.emphasis },
  }));

  const leading = preamble.join("\n").trim();
  const first = segments[0];
  if (leading && first)
    first.narration = [leading, first.narration].filter(Boolean).join("\n\n");

  return {
    isStructured: true,
    // Every scene is headed, which is what lets analysis keep the creator's
    // own segmentation rather than inventing one.
    hasSegmentHeadings: true,
    segments,
    narration: segments
      .map((segment) => segment.narration)
      .filter((text) => text.trim() !== "")
      .join("\n\n"),
    excludedMarkers: [...excluded],
    unrecognizedMarkers: [],
    excludedCharacterCount,
  };
}
