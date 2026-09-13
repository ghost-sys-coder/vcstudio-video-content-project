/**
 * Separates the words a narrator speaks from the production directions around
 * them.
 *
 * **Why this exists.** Scene analysis validates that the scenes it produces
 * reproduce the approved script exactly, in order, with nothing invented and
 * nothing skipped. That check is the reason a scene plan can be trusted, and it
 * assumes the approved script is narration. A script written the way scripts
 * are actually written is not: it carries `[VISUAL CUE: ...]` blocks, speaker
 * labels like `HOST (ON CAMERA):`, section headings and horizontal rules. The
 * model reads those correctly, narrates only the spoken words, and the coverage
 * check then fails at character zero because the script begins with a stage
 * direction that nobody says out loud.
 *
 * So the fix is not to loosen the check. The check is right. What was missing
 * is a step that turns a production script into a narration script before it is
 * approved, and keeps the directions instead of discarding them, because those
 * directions are exactly what the storyboard wants to know.
 *
 * **Why this is a parser and not a model call.** Everything here is a
 * convention with a shape: brackets close, speaker labels are capitalised and
 * end in a colon, rules are rows of dashes. A parser handles that instantly,
 * for free, identically every time, and can show precisely what it removed so a
 * person can disagree. A model would be slower, cost money per script, and
 * occasionally rewrite a sentence while claiming to have only cleaned it. A
 * model pass is the right fallback for a script with no conventions at all,
 * where narration and direction are mixed in prose, but it should never be the
 * first resort.
 *
 * Everything here is conservative: where a line is ambiguous it is kept as
 * narration. Losing a line of narration is silent and unrecoverable, whereas
 * keeping a stray direction is visible in the preview and easy to fix by hand.
 */

export type ScriptSegmentKind =
  /** Words the narrator speaks. */
  | "narration"
  /** A bracketed production note: visuals, graphics, music, timing. */
  | "direction"
  /** A speaker label such as `HOST (VOICEOVER):`. */
  | "speaker"
  /** A horizontal rule separating sections. */
  | "rule";

export interface RemovedScriptSegment {
  kind: Exclude<ScriptSegmentKind, "narration">;
  text: string;
  /**
   * How many characters of narration precede this in the cleaned script, so a
   * direction can be attached to the passage it belongs to rather than floating.
   */
  narrationOffset: number;
}

export interface ParsedProductionScript {
  /** Narration only. This is what should be approved and matched against. */
  narration: string;
  /** What was taken out, in order, so a person can see and judge it. */
  removed: RemovedScriptSegment[];
  /** True when nothing was removed, so the interface can stay out of the way. */
  wasAlreadyNarration: boolean;
}

/** Three or more dashes, underscores, asterisks or em dashes on their own. */
const RULE_PATTERN = /^\s*(?:[-_*]\s*){3,}$|^\s*—{1,}\s*$/u;

/**
 * A speaker label: a name, optionally with a parenthetical, ending in a colon.
 *
 * The name must carry no lowercase letters, which is what keeps an ordinary
 * sentence beginning "Note:" or "The catch:" out of this. Scripts capitalise
 * speaker labels by convention, and requiring that is cheaper than being clever.
 */
const SPEAKER_PATTERN = /^\s*[A-Z0-9][A-Z0-9 .'’#-]*(?:\([^)]*\))?\s*:\s*$/u;

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

/**
 * Finds the end of a bracketed block that starts on this line.
 *
 * Returns the index of the line holding the closing bracket, or null when the
 * block never closes. Unclosed is treated as not-a-block on purpose: swallowing
 * the rest of a script because someone forgot a bracket would be the worst
 * possible failure, and a stray `[` left in the narration is obvious.
 */
function findBlockEnd(lines: string[], start: number): number | null {
  let depth = 0;
  for (let index = start; index < lines.length; index += 1) {
    for (const character of lines[index]) {
      if (character === "[") depth += 1;
      else if (character === "]") {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    // A blank line inside an unclosed bracket almost certainly means the
    // bracket was never closed, rather than a block spanning paragraphs.
    if (depth > 0 && index > start && isBlank(lines[index])) return null;
  }
  return null;
}

export function parseProductionScript(raw: string): ParsedProductionScript {
  const lines = raw.replace(/\r\n?/gu, "\n").split("\n");
  const narrationParagraphs: string[] = [];
  const removed: RemovedScriptSegment[] = [];
  let current: string[] = [];
  let narrationLength = 0;

  const flush = () => {
    if (current.length === 0) return;
    const paragraph = current.join(" ").replace(/\s+/gu, " ").trim();
    current = [];
    if (paragraph.length === 0) return;
    narrationParagraphs.push(paragraph);
    // Plus the separator that will join paragraphs, so offsets line up with
    // the narration string this function returns.
    narrationLength +=
      paragraph.length + (narrationParagraphs.length > 1 ? 2 : 0);
  };

  const remove = (kind: RemovedScriptSegment["kind"], text: string) => {
    const trimmed = text.trim();
    if (trimmed.length === 0) return;
    removed.push({ kind, text: trimmed, narrationOffset: narrationLength });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (isBlank(line)) {
      flush();
      continue;
    }

    if (RULE_PATTERN.test(line)) {
      flush();
      remove("rule", line);
      continue;
    }

    // A block only counts when the bracket opens the line. An inline "[sic]"
    // mid-sentence is part of the narration and must survive.
    if (line.trimStart().startsWith("[")) {
      const end = findBlockEnd(lines, index);
      if (end !== null) {
        flush();
        remove("direction", lines.slice(index, end + 1).join(" "));
        index = end;
        continue;
      }
    }

    if (SPEAKER_PATTERN.test(line)) {
      flush();
      remove("speaker", line);
      continue;
    }

    current.push(line.trim());
  }
  flush();

  return {
    narration: narrationParagraphs.join("\n\n"),
    removed,
    wasAlreadyNarration: removed.length === 0,
  };
}
