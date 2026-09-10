import { AlertTriangleIcon, CheckIcon, CircleIcon } from "lucide-react";
import type { FinishingStepView } from "@/lib/publishing/youtube-finishing-steps";
import { describeOutstandingFinishing } from "@/lib/publishing/youtube-finishing-steps";

/**
 * What still has to happen before a release is genuinely finished.
 *
 * A step this app cannot do carries the instruction for doing it on YouTube.
 * The acceptance being met here is blunt: "published" must never stand in for
 * "published, but you still have to set the thumbnail yourself".
 */
export function PublicationFinishingList({
  steps,
}: {
  steps: FinishingStepView[];
}) {
  if (steps.length === 0) return null;
  const outstanding = describeOutstandingFinishing(steps);
  const shown = steps.filter((step) => step.state !== "skipped");
  if (shown.length === 0) return null;

  return (
    <section aria-label="Release finishing" className="space-y-2">
      {outstanding ? (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangleIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {outstanding}
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {shown.map((step) => (
          <li className="flex items-start gap-2 text-xs" key={step.step}>
            {step.state === "succeeded" ? (
              <CheckIcon
                aria-hidden
                className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
              />
            ) : (
              <CircleIcon
                aria-hidden
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
              />
            )}
            <span className="min-w-0">
              <span className="font-medium">{step.label}</span>
              <span className="text-muted-foreground">
                {" "}
                · {step.stateLabel}
              </span>
              {step.detail ? (
                <span className="block text-muted-foreground">
                  {step.detail}
                </span>
              ) : null}
              {step.externalAction ? (
                <span className="mt-0.5 block text-muted-foreground">
                  {step.externalAction}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
