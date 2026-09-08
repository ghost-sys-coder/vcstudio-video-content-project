import type { SceneAnalysisRun } from "@/db/schema";
import { NARRATION_FIDELITY_ERROR_CATEGORY } from "@/lib/scenes/scene-analysis-failure";

export function SceneAnalysisErrorState({ run }: { run: SceneAnalysisRun }) {
  // A fidelity rejection means the provider answered and billed, so the blanket
  // "reservation was released" line would be untrue for it.
  const billed = run.errorCategory === NARRATION_FIDELITY_ERROR_CATEGORY;
  return (
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
      role="alert"
    >
      <h2 className="font-semibold text-destructive">
        {billed
          ? "Scene analysis did not match the approved script"
          : "Scene analysis failed"}
      </h2>
      <p className="mt-1 text-sm">
        {run.safeErrorMessage ?? "The analysis could not be completed."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {billed
          ? "No scenes were saved and any previous scene plan is unchanged. The generated plan was paid for, so this run is recorded in usage."
          : "No partial scenes were saved and the pending reservation was released."}
      </p>
    </div>
  );
}
