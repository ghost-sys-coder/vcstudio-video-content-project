import { CheckIcon, CircleDotIcon, CircleIcon } from "lucide-react";
import type { ProductionRunStageView } from "@/lib/production-runs/production-run-view";

const MODE_LABELS = {
  auto: "automatic",
  hold: "waits for you",
  review: "your review",
} as const;

/** The run's stages, what each decides on its own, and where it has reached. */
export function ProductionRunStageList({
  stages,
}: {
  stages: ProductionRunStageView[];
}) {
  return (
    <ol aria-label="Run stages" className="flex flex-wrap gap-2">
      {stages.map((stage) => (
        <li
          aria-current={stage.state === "current" ? "step" : undefined}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${
            stage.state === "current"
              ? "border-primary/40 bg-primary/10 font-medium text-primary"
              : stage.state === "done"
                ? "text-muted-foreground"
                : "border-dashed text-muted-foreground"
          }`}
          key={stage.stage}
        >
          {stage.state === "done" ? (
            <CheckIcon aria-hidden className="size-3.5" />
          ) : stage.state === "current" ? (
            <CircleDotIcon aria-hidden className="size-3.5" />
          ) : (
            <CircleIcon aria-hidden className="size-3.5 opacity-50" />
          )}
          <span>{stage.label}</span>
          <span className="text-[10px] uppercase tracking-wide opacity-70">
            {MODE_LABELS[stage.mode]}
            {stage.attempts > 1 ? ` · ${stage.attempts} attempts` : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}
