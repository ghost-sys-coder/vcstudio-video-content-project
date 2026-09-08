import { sceneContentSchema, type SceneContent } from "@/lib/schemas/scene";

/** Compare editorial input only; identity and derived timing are not edits. */
export function hasSceneContentChanged(
  before: SceneContent,
  after: SceneContent,
) {
  return (
    JSON.stringify(sceneContentSchema.parse(before)) !==
    JSON.stringify(sceneContentSchema.parse(after))
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
