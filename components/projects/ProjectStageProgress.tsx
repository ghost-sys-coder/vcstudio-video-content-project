import Link from "next/link";
import { CheckIcon, CircleDotIcon, CircleIcon } from "lucide-react";
import type { StageStep } from "@/lib/production/production-stages";

/**
 * Where the project has reached, and a way into each stage.
 *
 * Every step is a link, so a creator can move around without knowing the tab
 * names. Nothing here starts work: these navigate only.
 */
export function ProjectStageProgress({
  projectId,
  steps,
}: {
  projectId: string;
  steps: StageStep[];
}) {
  return (
    <nav aria-label="Production stages">
      <ol className="flex flex-wrap gap-2">
        {steps.map((step) => (
          <li key={step.stage}>
            <Link
              aria-current={step.state === "current" ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                step.state === "current"
                  ? "border-primary/40 bg-primary/10 font-medium text-primary"
                  : step.state === "done"
                    ? "text-muted-foreground hover:bg-muted"
                    : "border-dashed text-muted-foreground hover:bg-muted"
              }`}
              href={`/app/projects/${projectId}/${step.href}`}
            >
              {step.state === "done" ? (
                <CheckIcon aria-hidden className="size-3.5" />
              ) : step.state === "current" ? (
                <CircleDotIcon aria-hidden className="size-3.5" />
              ) : (
                <CircleIcon aria-hidden className="size-3.5 opacity-50" />
              )}
              {step.label}
              <span className="sr-only">
                {step.state === "done"
                  ? " (passed)"
                  : step.state === "current"
                    ? " (current stage)"
                    : " (not started)"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
