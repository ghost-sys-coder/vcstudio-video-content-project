/**
 * Reads the structure a creator already put in their own script.
 *
 * A script written outside this tool usually arrives already broken into
 * segments, with production directions mixed into the same document:
 *
 *   [0:00 - 1:15] Hook: The 7-Day Reset
 *   [VISUAL] Fast-paced B-roll of a calendar. [TEXT OVERLAY] THE 21-DAY LIE
 *   [VOICEOVER / HOST (A-ROLL)] Every productivity guru will tell you...
 *
 * Two things must be true at once. The document is the creator's and must come
 * back byte-for-byte unchanged, so nothing here rewrites it. And the narration
 * that reaches text-to-speech must contain only what is meant to be spoken: a
 * narrator must never read "TEXT OVERLAY" or a description of the B-roll out
 * loud, and the creator must not be billed for synthesising it.
 *
 * So this module reads, and never edits. It returns where the segments are,
 * which spans are spoken, and which are production direction. Callers decide
 * what to do with that; the stored script is untouched either way.
 *
 * The conservative default that governs the whole module: **a script with no
 * recognised markers is entirely narration**, exactly as before this existed.
 * Structure is only claimed when the document actually shows it, so an ordinary
 * pasted script behaves the way it always has.
 */

/** What a bracketed marker means for the narration track. */
export type ScriptDirectiveKind =
  /** Spoken aloud. The only kind that reaches narration. */
  | "narration"
  /** Imagery direction: shots, B-roll, on-screen action. */
  | "visual"
  /** Words rendered on screen rather than spoken. */
  | "overlay"
  /** Music, sound effects, audio beds. */
  | "audio"
  /** Recognised as a marker by shape, but not by vocabulary. */
  | "unknown";

export interface ScriptDirective {
  /** The marker exactly as written, without its brackets. */
  marker: string;
  kind: ScriptDirectiveKind;
  /** The text that followed the marker, trimmed. */
  text: string;
}

export interface ScriptTimecode {
  /** The marker exactly as written, without its brackets. */
  raw: string;
  startSeconds: number;
  /** Null for an open-ended final segment, written as "End". */
  endSeconds: number | null;
}

export interface ScriptSegment {
  /** 1-based, in document order. */
  number: number;
  /** The heading text beside the timecode, or "" when there is none. */
  title: string;
  timecode: ScriptTimecode | null;
  /** Exactly what is spoken in this segment, in order, joined by blank lines. */
  narration: string;
  /** Everything not spoken, kept so it can be shown and used downstream. */
  directives: ScriptDirective[];
}

export interface ScriptStructure {
  /**
   * True when the document showed recognisable structure. False means the whole
   * script is narration and every legacy behaviour applies unchanged.
   */
  isStructured: boolean;
  /** True when at least one timecoded heading was found. */
  hasSegmentHeadings: boolean;
  segments: ScriptSegment[];
  /** Every spoken span, in order. This is what narration should be built from. */
  narration: string;
  /** Distinct markers whose text was kept out of narration. */
  excludedMarkers: string[];
  /** Distinct markers recognised by shape but not vocabulary, for review. */
  unrecognizedMarkers: string[];
  /** Characters of the original document that narration deliberately omits. */
  excludedCharacterCount: number;
}

/**
 * A marker is a bracketed run that reads as a label rather than as prose:
 * upper-case letters, digits and light punctuation, no lower-case, at most a
 * short phrase. Requiring the absence of lower-case is what keeps an ordinary
 * aside like "[see chapter two]" in the narration where it belongs.
 */
const MARKER_PATTERN = /\[([^\[\]\n]{1,60})\]/gu;

const TIMECODE_PATTERN =
  /^\s*(\d{1,3}):([0-5]\d)(?::([0-5]\d))?\s*[-–—]\s*(?:(\d{1,3}):([0-5]\d)(?::([0-5]\d))?|end)\s*$/iu;

/**
 * Vocabulary, checked as whole words so "A-ROLL" and "B-ROLL" cannot be
 * confused with one another. Narration is checked first: a combined marker such
 * as "VOICEOVER / HOST (A-ROLL)" is spoken, and must not be captured by a
 * production keyword appearing later in the same label.
 */
const NARRATION_KEYWORDS = [
  "VOICEOVER",
  "VOICE OVER",
  "VOICE-OVER",
  "VO",
  "NARRATION",
  "NARRATOR",
  "HOST",
  "A-ROLL",
  "A ROLL",
  "DIALOGUE",
  "SPEAKER",
  "SCRIPT",
  "SAY",
  "SPOKEN",
];

const VISUAL_KEYWORDS = [
  "VISUAL",
  "VISUALS",
  "B-ROLL",
  "B ROLL",
  "BROLL",
  "FOOTAGE",
  "SHOT",
  "CAMERA",
  "CUT TO",
  "CUT",
  "TRANSITION",
  "ANIMATION",
  "GRAPHIC",
  "GRAPHICS",
  "IMAGE",
  "SCREEN RECORDING",
  "ON SCREEN",
  "ONSCREEN",
];

const OVERLAY_KEYWORDS = [
  "TEXT OVERLAY",
  "OVERLAY",
  "TEXT",
  "TITLE",
  "CAPTION",
  "LOWER THIRD",
  "SUBTITLE",
];

const AUDIO_KEYWORDS = [
  "SOUND EFFECT",
  "SOUND EFFECTS",
  "SFX",
  "SOUND",
  "MUSIC",
  "AUDIO",
  "BEAT",
  "SILENCE",
];

/** Splits a label into comparable word runs, so matching is never substring. */
function labelTokens(label: string): string[] {
  return label
    .toUpperCase()
    .split(/[^A-Z0-9-]+/u)
    .filter(Boolean);
}

function mentions(label: string, keywords: string[]): boolean {
  const tokens = labelTokens(label);
  const joined = tokens.join(" ");
  return keywords.some((keyword) => {
    const target = keyword.toUpperCase();
    if (target.includes(" "))
      return (
        joined.includes(target) || joined.includes(target.replace(" ", "-"))
      );
    return tokens.includes(target);
  });
}

/**
 * A label is only treated as a marker when it carries no lower-case letters and
 * at least one letter. Prose in brackets therefore stays in the narration.
 */
function looksLikeMarker(label: string): boolean {
  return /[A-Z]/u.test(label) && !/[a-z]/u.test(label);
}

export function classifyScriptMarker(label: string): ScriptDirectiveKind {
  if (mentions(label, NARRATION_KEYWORDS)) return "narration";
  if (mentions(label, OVERLAY_KEYWORDS)) return "overlay";
  if (mentions(label, AUDIO_KEYWORDS)) return "audio";
  if (mentions(label, VISUAL_KEYWORDS)) return "visual";
  return "unknown";
}

export function parseScriptTimecode(label: string): ScriptTimecode | null {
  const match = TIMECODE_PATTERN.exec(label);
  if (!match) return null;
  const toSeconds = (h: string, m: string, s?: string) =>
    s === undefined
      ? Number(h) * 60 + Number(m)
      : Number(h) * 3600 + Number(m) * 60 + Number(s);
  const startSeconds = toSeconds(match[1] ?? "0", match[2] ?? "0", match[3]);
  const endSeconds =
    match[4] === undefined
      ? null
      : toSeconds(match[4], match[5] ?? "0", match[6]);
  return { raw: label.trim(), startSeconds, endSeconds };
}

interface Region {
  label: string | null;
  kind: ScriptDirectiveKind;
  timecode: ScriptTimecode | null;
  text: string;
}

/** Splits the document into marked regions without altering any of the text. */
function readRegions(content: string): Region[] {
  const regions: Region[] = [];
  let cursor = 0;
  let current: Region = {
    label: null,
    kind: "narration",
    timecode: null,
    text: "",
  };

  MARKER_PATTERN.lastIndex = 0;
  for (
    let match = MARKER_PATTERN.exec(content);
    match !== null;
    match = MARKER_PATTERN.exec(content)
  ) {
    const label = match[1] ?? "";
    // A timecode heading is tested first: it carries no letters at all, and
    // "End" carries lower-case ones, so the label-shape gate below would
    // reject every heading in a normally written script.
    const timecode = parseScriptTimecode(label);
    if (!timecode && !looksLikeMarker(label)) continue;
    current.text += content.slice(cursor, match.index);
    regions.push(current);
    current = {
      label,
      kind: timecode ? "narration" : classifyScriptMarker(label),
      timecode,
      text: "",
    };
    cursor = match.index + match[0].length;
  }
  current.text += content.slice(cursor);
  regions.push(current);
  return regions;
}

/** Joins spans with a blank line, skipping empties, without touching content. */
function join(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function parseScriptStructure(content: string): ScriptStructure {
  const regions = readRegions(content);
  const marked = regions.filter((region) => region.label !== null);

  if (marked.length === 0)
    return {
      isStructured: false,
      hasSegmentHeadings: false,
      segments: [
        {
          number: 1,
          title: "",
          timecode: null,
          narration: content.trim(),
          directives: [],
        },
      ],
      narration: content.trim(),
      excludedMarkers: [],
      unrecognizedMarkers: [],
      excludedCharacterCount: 0,
    };

  const segments: ScriptSegment[] = [];
  const excluded = new Set<string>();
  const unrecognized = new Set<string>();
  let excludedCharacterCount = 0;

  let narrationParts: string[] = [];
  let directives: ScriptDirective[] = [];
  let title = "";
  let timecode: ScriptTimecode | null = null;
  let started = false;

  const flush = () => {
    const narration = join(narrationParts);
    if (!started && narration === "" && directives.length === 0) return;
    segments.push({
      number: segments.length + 1,
      title,
      timecode,
      narration,
      directives,
    });
    narrationParts = [];
    directives = [];
    title = "";
    timecode = null;
  };

  for (const region of regions) {
    if (region.timecode) {
      flush();
      started = true;
      timecode = region.timecode;
      // The heading's own line names the segment; anything after it on later
      // lines is ordinary narration and is kept as such.
      const [headingLine, ...rest] = region.text.split("\n");
      title = (headingLine ?? "").trim();
      const remainder = rest.join("\n").trim();
      if (remainder) narrationParts.push(remainder);
      continue;
    }

    if (region.kind === "narration") {
      if (region.text.trim()) narrationParts.push(region.text);
      continue;
    }

    // Everything below is production direction, kept out of narration.
    if (region.label !== null) {
      excluded.add(region.label.trim());
      if (region.kind === "unknown") unrecognized.add(region.label.trim());
      excludedCharacterCount += region.label.length + 2 + region.text.length;
      directives.push({
        marker: region.label.trim(),
        kind: region.kind,
        text: region.text.trim(),
      });
    }
  }
  flush();

  const narration = join(segments.map((segment) => segment.narration));

  return {
    isStructured: true,
    hasSegmentHeadings: segments.some((segment) => segment.timecode !== null),
    segments,
    narration,
    excludedMarkers: [...excluded],
    unrecognizedMarkers: [...unrecognized],
    excludedCharacterCount,
  };
}

/**
 * The spoken text of a script.
 *
 * For a script with no markers this is the script itself, so nothing that
 * worked before changes. For a structured script it is only the narration,
 * which is what should be synthesised, costed and held to fidelity checks.
 */
export function extractNarration(content: string): string {
  return parseScriptStructure(content).narration;
}
