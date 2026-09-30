import {
  editableSceneContentSchema,
  type EditableSceneContent,
} from "@/lib/schemas/scene";

/** Compare editorial input only; identity and derived timing are not edits. */
export function hasSceneContentChanged(
  before: EditableSceneContent,
  after: EditableSceneContent,
) {
  return (
    JSON.stringify(editableSceneContentSchema.parse(before)) !==
    JSON.stringify(editableSceneContentSchema.parse(after))
  );
}

/** Current storyboard timing is a projection, never a rewrite of history. */
export function projectCurrentSceneTimings<
  T extends {
    version: {
      estimatedDurationMilliseconds: number;
      startTimeMilliseconds: number;
      endTimeMilliseconds: number;
    };
  },
>(rows: T[]): T[] {
  let cursor = 0;
  return rows.map((row) => {
    const startTimeMilliseconds = cursor;
    cursor += row.version.estimatedDurationMilliseconds;
    return {
      ...row,
      version: {
        ...row.version,
        startTimeMilliseconds,
        endTimeMilliseconds: cursor,
      },
    };
  });
}

export class SceneRevisionConflictError extends Error {
  readonly code = "SCENE_REVISION_CONFLICT";
  constructor() {
    super("SCENE_REVISION_CONFLICT");
    this.name = "SceneRevisionConflictError";
  }
}

/**
 * Speech generation consumes narration and its delivery direction; images
 * consume the visual brief. Changing how a line should be delivered makes the
 * approved narration stale just as changing the words does.
 */
export function sceneMediaCompatibility(
  before: EditableSceneContent,
  after: EditableSceneContent,
) {
  const visualFields = [
    "visualDescription",
    "locationDescription",
    "actionDescription",
    "cameraShot",
    "cameraAngle",
    "cameraMotion",
    "emotionalTone",
    "characterNames",
    "propNames",
    "continuityNotes",
  ] as const;
  return {
    audio:
      before.narrationText === after.narrationText &&
      before.voiceTone === after.voiceTone &&
      before.voicePacing === after.voicePacing &&
      JSON.stringify(before.voiceEmphasis) ===
        JSON.stringify(after.voiceEmphasis),
    image: visualFields.every(
      (field) => JSON.stringify(before[field]) === JSON.stringify(after[field]),
    ),
  };
}
