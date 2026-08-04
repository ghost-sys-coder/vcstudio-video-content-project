import { UsersRoundIcon } from "lucide-react";

/**
 * Shared empty state for the brand list tabs.
 *
 * One component rather than one per list: the two lists differ only in wording,
 * and a second file would be a copy that drifts.
 */
export function EmptyBrandListState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 p-10 text-center">
      <UsersRoundIcon aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
