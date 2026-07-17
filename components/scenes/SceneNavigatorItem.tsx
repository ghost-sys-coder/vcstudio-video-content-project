import type { SceneNavigationRow } from "@/lib/scenes/scene-navigation";
import { Button } from "@/components/ui/button";
import { SceneImageIndicatorBadge } from "@/components/scenes/SceneImageIndicatorBadge";
import { SceneStatusBadge } from "@/components/scenes/SceneStatusBadge";
import { cn } from "@/lib/utils";

export function SceneNavigatorItem({
  row,
  selected,
  onSelect,
}: {
  row: SceneNavigationRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      aria-current={selected ? "true" : undefined}
      className={cn(
        "h-auto w-full items-start justify-start gap-3 rounded-xl border px-3 py-3 text-left whitespace-normal",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/15 hover:bg-primary/10"
          : "border-transparent bg-transparent hover:border-border hover:bg-muted/70",
      )}
      onClick={onSelect}
      type="button"
      variant="ghost"
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold",
          selected && "bg-primary text-primary-foreground",
        )}
      >
        {row.scene.sceneNumber}
      </span>
      <span className="min-w-0 flex-1 space-y-1.5">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium">Scene {row.scene.sceneNumber}</span>
          <span className="flex items-center gap-1">
            {row.imageIndicator ? (
              <SceneImageIndicatorBadge indicator={row.imageIndicator} />
            ) : null}
            <SceneStatusBadge status={row.scene.status} />
          </span>
        </span>
        <span className="line-clamp-2 block text-xs leading-5 text-muted-foreground">
          {row.version.narrationText}
        </span>
      </span>
    </Button>
  );
}
