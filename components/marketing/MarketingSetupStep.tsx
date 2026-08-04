import { CheckCircle2Icon, CircleDashedIcon, LockIcon } from "lucide-react";
import Link from "next/link";

export type MarketingSetupStepState = "done" | "available" | "locked";

/**
 * One row of the studio's setup checklist.
 *
 * `locked` is shown rather than hidden on purpose: the studio is delivered in
 * slices, and a step that simply does not appear reads as a missing feature. A
 * visible, explained lock reads as a roadmap.
 */
export function MarketingSetupStep({
  description,
  href,
  label,
  state,
}: {
  description: string;
  href?: string;
  label: string;
  state: MarketingSetupStepState;
}) {
  const Icon =
    state === "done"
      ? CheckCircle2Icon
      : state === "available"
        ? CircleDashedIcon
        : LockIcon;

  const tone =
    state === "done" ? "text-notice-ready-foreground" : "text-muted-foreground";

  return (
    <li className="flex items-start gap-3 rounded-lg border p-3">
      <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {state === "available" && href ? (
            <Link className="underline underline-offset-4" href={href}>
              {label}
            </Link>
          ) : (
            label
          )}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {state === "locked" ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          Not built yet
        </span>
      ) : null}
    </li>
  );
}
