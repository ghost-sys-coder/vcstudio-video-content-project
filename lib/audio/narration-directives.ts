/**
 * Delivery markers written inside narration: pauses such as `[PAUSE: 0.5s]`,
 * and raised-voice spans such as `[RAISE]confidence[/RAISE]`.
 *
 * Markers are delivery, not speech. A voice model shown one either reads it
 * aloud or ignores it, so every marker stays in the stored narration, where
 * the creator wrote it and where fidelity checks compare it, and is resolved
 * here:
 *
 * - A pause splits the narration. Each spoken part is voiced on its own and a
 *   silence of the written length is inserted between them, exactly.
 * - A raised span does not split anything. The words stay in one sentence so
 *   the delivery flows, and the span is named in the scene's direction to the
 *   voice instead. Each speech part still records which of its words were
 *   raised, for a delivery mode that voices them separately.
 *
 * Captions and cost counts use the spoken text alone. Dependency-free so the
 * browser, the server and the worker agree.
 */

/** One stretch of a speech part, raised or at normal level. */
export interface SpeechSpan {
  text: string;
  raised: boolean;
}

/** The narration part a voice speaks, or a silence of a fixed length. */
export type NarrationPart =
  | {
      kind: "speech";
      text: string;
      /** Present only when part of this speech is raised. */
      spans?: SpeechSpan[];
    }
  | { kind: "pause"; milliseconds: number };

export const DEFAULT_PAUSE_MILLISECONDS = 500;
export const MINIMUM_PAUSE_MILLISECONDS = 100;
export const MAXIMUM_PAUSE_MILLISECONDS = 10_000;
/** More raised phrases than this in one scene is no longer emphasis. */
export const MAXIMUM_RAISED_PHRASES = 10;

/**
 * `[PAUSE]`, `[PAUSE: 0.5s]`, `[pause 800ms]`, `[BREAK: 1 sec]`. The keyword
 * must stand alone in the brackets, so an aside such as "[pause for thought]"
 * is not mistaken for timing.
 */
const PAUSE_MARKER_SOURCE =
  "\\[\\s*(?:PAUSE|BREAK)\\s*(?::\\s*|\\s+)?(?:(\\d+(?:\\.\\d+)?)\\s*(ms|milliseconds?|s|secs?|seconds?)?)?\\s*\\]";

/** `[RAISE]` opens a raised span and `[/RAISE]` closes it. */
const RAISE_OPEN_SOURCE = "\\[\\s*RAISE\\s*\\]";
const RAISE_CLOSE_SOURCE = "\\[\\s*\\/\\s*RAISE\\s*\\]";

function pauseMarkerPattern(): RegExp {
  return new RegExp(PAUSE_MARKER_SOURCE, "giu");
}

function raiseMarkerPattern(): RegExp {
  return new RegExp(`${RAISE_OPEN_SOURCE}|${RAISE_CLOSE_SOURCE}`, "giu");
}

/** Every marker, labelled by which alternative matched. */
function markerPattern(): RegExp {
  return new RegExp(
    `(${PAUSE_MARKER_SOURCE})|(${RAISE_OPEN_SOURCE})|(${RAISE_CLOSE_SOURCE})`,
    "giu",
  );
}

/** True when the text inside a pair of brackets is a pause marker. */
export function isPauseMarker(bracketed: string): boolean {
  return new RegExp(`^${PAUSE_MARKER_SOURCE}$`, "iu").test(`[${bracketed}]`);
}

/**
 * True when the text inside a pair of brackets is any delivery marker that
 * belongs in narration: a pause, or either end of a raised span.
 */
export function isNarrationDeliveryMarker(bracketed: string): boolean {
  return (
    isPauseMarker(bracketed) ||
    new RegExp(`^(?:${RAISE_OPEN_SOURCE}|${RAISE_CLOSE_SOURCE})$`, "iu").test(
      `[${bracketed}]`,
    )
  );
}

function pauseMilliseconds(amount?: string, unit?: string): number {
  if (amount === undefined) return DEFAULT_PAUSE_MILLISECONDS;
  const value = Number(amount);
  const milliseconds = unit && /^m/iu.test(unit) ? value : value * 1_000;
  return Math.min(
    MAXIMUM_PAUSE_MILLISECONDS,
    Math.max(MINIMUM_PAUSE_MILLISECONDS, Math.round(milliseconds)),
  );
}

function collapse(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/**
 * Splits narration into spoken parts and silences, in order.
 *
 * Adjacent pauses are added together, empty speech is dropped, and a scene
 * without markers comes back as one speech part — so a narration with no
 * markers is synthesised exactly as it always was. Raise markers never split a
 * part; they are removed from its text and recorded in its `spans`. A raised
 * span left open runs to the end of the scene, across any pause.
 */
export function parseNarrationParts(narration: string): NarrationPart[] {
  const parts: NarrationPart[] = [];
  let raising = false;
  let pending: SpeechSpan[] = [];

  const flushSpeech = () => {
    const text = collapse(pending.map((span) => span.text).join(""));
    const spans = pending
      .map((span) => ({ text: collapse(span.text), raised: span.raised }))
      .filter((span) => span.text !== "");
    if (text !== "")
      parts.push(
        spans.some((span) => span.raised)
          ? { kind: "speech", text, spans }
          : { kind: "speech", text },
      );
    pending = [];
  };
  const pushPause = (milliseconds: number) => {
    const last = parts.at(-1);
    if (last?.kind === "pause")
      last.milliseconds = Math.min(
        MAXIMUM_PAUSE_MILLISECONDS,
        last.milliseconds + milliseconds,
      );
    else parts.push({ kind: "pause", milliseconds });
  };

  let cursor = 0;
  for (const match of narration.matchAll(markerPattern())) {
    const before = narration.slice(cursor, match.index);
    if (before) pending.push({ text: before, raised: raising });
    cursor = match.index + match[0].length;
    if (match[1] !== undefined) {
      flushSpeech();
      pushPause(pauseMilliseconds(match[2], match[3]));
    } else if (match[4] !== undefined) raising = true;
    else raising = false;
  }
  const rest = narration.slice(cursor);
  if (rest) pending.push({ text: rest, raised: raising });
  flushSpeech();
  return parts;
}

/** The words a listener hears: markers removed, whitespace collapsed. */
export function stripNarrationDirectives(narration: string): string {
  return collapse(
    narration
      .replace(pauseMarkerPattern(), " ")
      .replace(raiseMarkerPattern(), ""),
  );
}

/** True when the narration asks for at least one timed silence. */
export function hasNarrationPauses(narration: string): boolean {
  return pauseMarkerPattern().test(narration);
}

/**
 * The phrases the creator marked to be delivered with a raised voice, in
 * order, without repeats — the words the scene's direction will name.
 */
export function extractRaisedPhrases(narration: string): string[] {
  const phrases: string[] = [];
  for (const part of parseNarrationParts(narration)) {
    if (part.kind !== "speech" || !part.spans) continue;
    for (const span of part.spans)
      if (span.raised && !phrases.includes(span.text)) phrases.push(span.text);
  }
  return phrases.slice(0, MAXIMUM_RAISED_PHRASES);
}
