import type { SceneAnalysisRun } from "@/db/schema";

export function SceneAnalysisErrorState({ run }: { run: SceneAnalysisRun }) {
  return (
    <div
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"
      role="alert"
    >
      <h2 className="font-semibold text-destructive">Scene analysis failed</h2>
      <p className="mt-1 text-sm">
        {run.safeErrorMessage ?? "The analysis could not be completed."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        No partial scenes were saved and the pending reservation was released.
      </p>
    </div>
  );
}
