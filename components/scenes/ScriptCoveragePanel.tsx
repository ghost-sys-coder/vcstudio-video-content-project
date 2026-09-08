import { AlertTriangleIcon, CheckIcon, InfoIcon } from "lucide-react";
import type { ScriptCoverageView } from "@/lib/scenes/script-coverage-view";

const DISCREPANCY_LABELS = {
  empty_narration: "Empty narration",
  missing_narration: "Missing narration",
  duplicated_narration: "Duplicated narration",
  reordered_narration: "Scenes out of order",
  invented_narration: "Narration not in the script",
  uncovered_script_tail: "Uncovered end of script",
} as const;

export function ScriptCoveragePanel({ view }: { view: ScriptCoverageView }) {
  if (view.status === "no_script" || view.status === "no_scenes") return null;
  const covered = view.status === "covered";

  return (
    <section
      className={
        covered
          ? "rounded-xl border border-emerald-600/30 bg-emerald-50/40 p-4 dark:bg-emerald-950/20"
          : "rounded-xl border border-destructive/30 bg-destructive/5 p-4"
      }
    >
      <div className="flex items-start gap-2">
        {covered ? (
          <CheckIcon aria-hidden className="mt-0.5 size-4 text-emerald-600" />
        ) : (
          <AlertTriangleIcon
            aria-hidden
            className="mt-0.5 size-4 text-destructive"
          />
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            {covered
              ? "Scene narration matches the approved script"
              : "Scene narration does not match the approved script"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{view.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {view.sceneCount} scenes · {view.coveredCharacters.toLocaleString()}{" "}
            of {view.scriptCharacters.toLocaleString()} script characters
            covered ({view.coveragePercent}%)
            {view.scriptVersionNumber === null
              ? null
              : ` · approved script v${view.scriptVersionNumber}`}
          </p>
        </div>
      </div>

      {view.discrepancies.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {view.discrepancies.map((discrepancy, index) => (
            <li
              key={`${discrepancy.kind}-${discrepancy.scriptCharacterOffset}-${index}`}
              className="rounded-lg border bg-background/60 p-3"
            >
              <p className="text-sm font-medium">
                {DISCREPANCY_LABELS[discrepancy.kind]}
                {discrepancy.sceneNumber === null
                  ? null
                  : ` · scene ${discrepancy.sceneNumber}`}
                {discrepancy.punctuationOnly ? (
                  <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-400">
                    punctuation only
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {discrepancy.message}
              </p>
              <dl className="mt-2 space-y-2 text-xs">
                <div>
                  <dt className="font-medium">Approved script says</dt>
                  <dd className="mt-0.5 rounded bg-muted p-2 font-mono break-words whitespace-pre-wrap">
                    {discrepancy.expectedExcerpt || "(end of script)"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium">Scene narration says</dt>
                  <dd className="mt-0.5 rounded bg-muted p-2 font-mono break-words whitespace-pre-wrap">
                    {discrepancy.receivedExcerpt || "(nothing)"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">
          Compare scene narration to the approved script
        </summary>
        <ol className="mt-2 space-y-1.5">
          {view.scenes.map((scene) => (
            <li
              key={scene.sceneNumber}
              className={
                scene.divergent
                  ? "rounded border border-destructive/40 bg-background/60 p-2 text-xs"
                  : "rounded border bg-background/60 p-2 text-xs"
              }
            >
              <span className="font-medium">Scene {scene.sceneNumber}</span>
              {scene.divergent ? (
                <span className="ml-2 text-destructive">first divergence</span>
              ) : null}
              <p className="mt-0.5 break-words text-muted-foreground">
                {scene.narrationPreview}
              </p>
            </li>
          ))}
        </ol>
      </details>

      {covered ? null : (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
          <InfoIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Edit the affected scene narration, or re-run analysis, before
          generating images or narration audio from this plan.
        </p>
      )}
    </section>
  );
}
