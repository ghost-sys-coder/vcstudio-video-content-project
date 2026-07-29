import {
  CheckCircle2Icon,
  TriangleAlertIcon,
  XCircleIcon,
  type LucideIcon,
} from "lucide-react";
import type { AnimationCheckRow } from "@/lib/characters/animation-check-view";
import { cn } from "@/lib/utils";

const PRESENTATION: Record<
  AnimationCheckRow["status"],
  { icon: LucideIcon; className: string; srLabel: string }
> = {
  pass: {
    icon: CheckCircle2Icon,
    className: "text-emerald-600 dark:text-emerald-500",
    srLabel: "Passed",
  },
  warn: {
    icon: TriangleAlertIcon,
    className: "text-amber-600 dark:text-amber-500",
    srLabel: "Warning",
  },
  fail: {
    icon: XCircleIcon,
    className: "text-destructive",
    srLabel: "Failed",
  },
};

/** One pass/warn/fail line of the character animation check. */
export function AnimationCheckRowItem({ row }: { row: AnimationCheckRow }) {
  const { icon: Icon, className, srLabel } = PRESENTATION[row.status];
  return (
    <li className="flex gap-3 rounded-lg border p-3">
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", className)} />
      <div className="space-y-1">
        <p className="text-sm font-medium">
          <span className="sr-only">{srLabel}: </span>
          {row.label}
        </p>
        <p className="text-xs text-muted-foreground">{row.detail}</p>
      </div>
    </li>
  );
}
