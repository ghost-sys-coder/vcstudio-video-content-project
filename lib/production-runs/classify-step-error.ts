/**
 * Decides what a thrown error means for the run.
 *
 * Classified by name and code rather than by class, so this stays free of the
 * server-only stage modules and can be unit tested beside the executor. A
 * request error from a stage service is a reason the stage cannot proceed and
 * becomes a hold a person can read. A rate limit is temporary and becomes a
 * wait. Anything else is a defect and is rethrown for the worker to record.
 */
const REQUEST_ERROR_NAMES = new Set([
  "ScriptGenerationRequestError",
  "SceneAnalysisRequestError",
  "BulkSceneImageGenerationRequestError",
  "SceneImageGenerationRequestError",
  "SceneAudioGenerationRequestError",
  "VideoRenderRequestError",
  "VideoRenderTimelineInvalidError",
  "TitleGenerationRequestError",
  "ThumbnailGenerationRequestError",
  "ReleasePackageConflictError",
  "NarrationInputError",
]);

export type StepErrorClassification =
  | { kind: "hold"; message: string }
  | { kind: "wait"; message: string }
  | { kind: "unknown" };

export function classifyStepError(error: unknown): StepErrorClassification {
  if (!(error instanceof Error)) return { kind: "unknown" };
  const code = Reflect.get(error, "code");
  if (code === "RATE_LIMIT_EXCEEDED")
    return { kind: "wait", message: error.message };
  if (code === "BUDGET_EXCEEDED")
    return {
      kind: "hold",
      message: `${error.message} Raise the budget or wait for the window to reset, then resume.`,
    };
  if (REQUEST_ERROR_NAMES.has(error.name)) {
    const issues = Reflect.get(error, "issues");
    const detail = Array.isArray(issues)
      ? issues
          .map((issue) =>
            typeof issue === "object" && issue && "message" in issue
              ? String(Reflect.get(issue, "message"))
              : "",
          )
          .filter(Boolean)
          .slice(0, 5)
          .join(" ")
      : "";
    return {
      kind: "hold",
      message: detail ? `${error.message} ${detail}` : error.message,
    };
  }
  // Scene-level conflicts thrown as bare errors by the approval commands.
  if (/_CONFLICT$|_NOT_FOUND$|_NOT_SUCCESSFUL$/.test(error.message))
    return {
      kind: "hold",
      message:
        "Something changed underneath the run while it was working. Check the project and resume.",
    };
  return { kind: "unknown" };
}
