import type { CharacterStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

const characterStatusStyles = {
  active:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  draft:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  archived:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
} satisfies Record<CharacterStatus, string>;

const characterStatusDotStyles = {
  active: "bg-emerald-500",
  draft: "bg-amber-500",
  archived: "bg-slate-500",
} satisfies Record<CharacterStatus, string>;

export function CharacterStatusBadge({ status }: { status: CharacterStatus }) {
  return (
    <Badge
      className={`h-6 gap-1.5 border px-3 py-1 capitalize ${characterStatusStyles[status]}`}
      variant="outline"
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${characterStatusDotStyles[status]}`}
      />
      {status}
    </Badge>
  );
}
