"use client";

import { AlertTriangleIcon, ScissorsIcon } from "lucide-react";
import type { ScriptStructureView } from "@/lib/scripts/script-structure-view";

/**
 * Shows what was read out of a pasted script and what will not be spoken.
 *
 * Text is being kept out of the narration, so the creator is told exactly what
 * and why. Their script itself is never edited; this only describes how it will
 * be used.
 */
export function ScriptStructureNotice({ view }: { view: ScriptStructureView }) {
  if (!view.detected) return null;

  return (
    <section
      aria-labelledby="script-structure-heading"
      className="rounded-xl border bg-muted/40 p-3"
    >
      <div className="flex items-start gap-2">
        <ScissorsIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-medium" id="script-structure-heading">
            {view.directionOnly
              ? "Production direction detected"
              : `${view.segmentCount} scenes already in your script`}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {view.directionOnly
              ? "Your direction will be used for the visuals and kept out of the narration."
              : "These scenes will be used as written, so they are not worked out again."}{" "}
            Your script is not changed.
          </p>

          {view.excludedMarkers.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Not spoken:{" "}
              <span className="font-medium text-foreground">
                {view.excludedMarkers.join(", ")}
              </span>{" "}
              ({view.excludedCharacterCount.toLocaleString()} characters)
            </p>
          ) : null}

          {view.rows.length > 0 && !view.directionOnly ? (
            <ol className="mt-2 space-y-1">
              {view.rows.map((row) => (
                <li className="text-xs" key={row.number}>
                  <span className="font-medium">
                    {row.number}. {row.label}
                  </span>
                  {row.silent ? (
                    <span className="ml-1 text-amber-700 dark:text-amber-500">
                      nothing spoken in this scene
                    </span>
                  ) : (
                    <span className="ml-1 text-muted-foreground">
                      {row.narrationPreview}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          ) : null}

          {view.needsReview ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500">
              <AlertTriangleIcon
                aria-hidden
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>
                {view.unrecognizedMarkers.length > 0
                  ? `Check ${view.unrecognizedMarkers.join(", ")}: not recognised as direction, and kept out of the narration.`
                  : "A scene has no narration. It will not be spoken."}
              </span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
