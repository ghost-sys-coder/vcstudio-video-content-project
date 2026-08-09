import { CheckCircle2, Circle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import type { FirstValueMilestone } from "@/lib/onboarding/first-value-onboarding";

export function FirstValueMilestoneRow({
  milestone,
}: {
  milestone: FirstValueMilestone;
}) {
  const icon = milestone.complete ? (
    <CheckCircle2 className="size-4 text-emerald-600" />
  ) : milestone.blocked ? (
    <LockKeyhole className="size-4 text-amber-600" />
  ) : (
    <Circle className="size-4 text-muted-foreground" />
  );
  const content = (
    <>
      {icon}
      <span>{milestone.label}</span>
      {milestone.optional ? (
        <span className="text-xs text-muted-foreground">Optional</span>
      ) : null}
    </>
  );
  return (
    <li className="flex min-h-8 items-center gap-2 text-sm">
      {milestone.complete || milestone.blocked ? (
        content
      ) : (
        <Link
          className="flex items-center gap-2 underline-offset-4 hover:underline"
          href={milestone.href}
        >
          {content}
        </Link>
      )}
    </li>
  );
}
