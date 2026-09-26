import { sceneContentSchema, type SceneContent } from "@/lib/schemas/scene";

/**
 * Turns pasted JSON into scenes, forgivingly about shape and strict about
 * content.
 *
 * **It accepts the names people actually write.** A plan drafted elsewhere
 * calls the spoken line `narration`, not `narrationText`, and the picture
 * `visual_direction`, not `visualDescription`. Refusing those would mean every
 * creator rewriting a file they already have, field by field, to satisfy an
 * internal spelling they never chose. The aliases below are the cost of not
 * doing that to them.
 *
 * **It is strict about what a scene must say.** A scene with no narration is
 * not a scene this application can render, so it is reported by position and
 * by field rather than quietly created empty and discovered later in the
 * storyboard.
 *
 * Errors are collected for every scene rather than thrown at the first, because
 * somebody pasting twenty scenes wants the whole list of what to fix, not one
 * problem at a time.
 */

/** Runtime estimate rate, matching `calculateScriptStatistics`. */
const WORDS_PER_MINUTE = 150;
const MINIMUM_ESTIMATED_DURATION_MILLISECONDS = 1_000;

/** Ceiling on one paste, matching the analysis output limit. */
export const MAXIMUM_PASTED_SCENES = 500;

const ALIASES: Readonly<Record<keyof SceneContent, readonly string[]>> = {
  narrationText: ["narration", "narration_text", "text", "script", "voiceover"],
  visualDescription: [
    "visual_direction",
    "visualDirection",
    "visual",
    "visual_description",
    "visuals",
  ],
  locationDescription: ["location", "location_description", "setting"],
  actionDescription: ["action", "action_description"],
  cameraShot: ["shot", "camera_shot"],
  cameraAngle: ["angle", "camera_angle"],
  cameraMotion: ["motion", "camera_motion", "movement"],
  emotionalTone: ["tone", "emotional_tone", "emotion", "mood"],
  characterNames: ["characters", "character_names", "cast"],
  propNames: ["props", "prop_names", "objects"],
  continuityNotes: ["continuity", "continuity_notes", "notes"],
  estimatedDurationMilliseconds: [
    "estimated_duration_milliseconds",
    "durationMs",
    "duration_ms",
    "durationMilliseconds",
  ],
};

/** Duration written in seconds, which is how most people think about it. */
const SECOND_ALIASES = [
  "durationSeconds",
  "duration_seconds",
  "duration",
  "seconds",
] as const;

export interface PastedSceneIssue {
  /** 1-based position in the pasted list, for a message a person can act on. */
  scenePosition: number;
  field: string;
  message: string;
}

export type ParsePastedScenesResult =
  | { ok: true; scenes: SceneContent[] }
  | { ok: false; issues: PastedSceneIssue[]; summary: string };

function failure(summary: string, issues: PastedSceneIssue[] = []) {
  return { ok: false as const, issues, summary };
}

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
}

/** Estimated runtime for a scene that did not state one. */
export function estimateSceneDurationMilliseconds(narration: string): number {
  const seconds = (countWords(narration) / WORDS_PER_MINUTE) * 60;
  return Math.max(
    MINIMUM_ESTIMATED_DURATION_MILLISECONDS,
    Math.ceil(seconds) * 1_000,
  );
}

function readField(row: Record<string, unknown>, key: keyof SceneContent) {
  if (row[key] !== undefined) return row[key];
  for (const alias of ALIASES[key])
    if (row[alias] !== undefined) return row[alias];
  return undefined;
}

/** A list, or a comma-separated line, or nothing. */
function readNameList(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value))
    return value
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  if (typeof value === "string")
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  return undefined;
}

function readDuration(
  row: Record<string, unknown>,
  narration: string,
): number | undefined {
  const milliseconds = readField(row, "estimatedDurationMilliseconds");
  if (milliseconds !== undefined) {
    const value = Number(milliseconds);
    return Number.isFinite(value) ? Math.round(value) : Number.NaN;
  }
  for (const alias of SECOND_ALIASES)
    if (row[alias] !== undefined) {
      const value = Number(row[alias]);
      return Number.isFinite(value) ? Math.round(value * 1_000) : Number.NaN;
    }
  // Nothing stated, so it is worked out from the words rather than refused.
  // The finished video is timed by the recording regardless.
  return estimateSceneDurationMilliseconds(narration);
}

function normalize(row: Record<string, unknown>): Record<string, unknown> {
  const narration = String(readField(row, "narrationText") ?? "");
  const text = (key: keyof SceneContent) => {
    const value = readField(row, key);
    return typeof value === "string" ? value.trim() : value;
  };
  return {
    narrationText: narration.trim(),
    visualDescription: text("visualDescription"),
    locationDescription: text("locationDescription"),
    actionDescription: text("actionDescription"),
    cameraShot: text("cameraShot"),
    cameraAngle: text("cameraAngle"),
    cameraMotion: text("cameraMotion"),
    emotionalTone: text("emotionalTone"),
    characterNames: readNameList(readField(row, "characterNames")) ?? [],
    propNames: readNameList(readField(row, "propNames")) ?? [],
    continuityNotes: String(readField(row, "continuityNotes") ?? "").trim(),
    estimatedDurationMilliseconds: readDuration(row, narration),
  };
}

/** Unwraps the three shapes a paste arrives in. */
function readRows(parsed: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(parsed))
    return parsed.every((entry) => isPlainObject(entry))
      ? (parsed as Record<string, unknown>[])
      : null;
  if (isPlainObject(parsed)) {
    const wrapped = (parsed as { scenes?: unknown }).scenes;
    if (wrapped !== undefined) return readRows(wrapped);
    return [parsed as Record<string, unknown>];
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePastedScenes(input: string): ParsePastedScenesResult {
  const text = input.trim();
  if (!text) return failure("Paste one scene or a list of scenes.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure(
      "That is not valid JSON. Check for a missing comma, quote or bracket.",
    );
  }

  const rows = readRows(parsed);
  if (!rows)
    return failure(
      "Expected one scene object, a list of scene objects, or an object with a scenes list.",
    );
  if (rows.length === 0) return failure("That list has no scenes in it.");
  if (rows.length > MAXIMUM_PASTED_SCENES)
    return failure(
      `That is ${rows.length} scenes and the limit is ${MAXIMUM_PASTED_SCENES}. Split it into smaller pastes.`,
    );

  const scenes: SceneContent[] = [];
  const issues: PastedSceneIssue[] = [];

  for (const [index, row] of rows.entries()) {
    const result = sceneContentSchema.safeParse(normalize(row));
    if (result.success) {
      scenes.push(result.data);
      continue;
    }
    for (const issue of result.error.issues)
      issues.push({
        scenePosition: index + 1,
        field: String(issue.path[0] ?? "scene"),
        message: issue.message,
      });
  }

  if (issues.length === 0) return { ok: true, scenes };

  const positions = [...new Set(issues.map((issue) => issue.scenePosition))];
  return failure(
    positions.length === 1
      ? `Scene ${positions[0]} is not complete yet. Nothing was added.`
      : `${positions.length} of ${rows.length} scenes are not complete yet. Nothing was added.`,
    issues,
  );
}
