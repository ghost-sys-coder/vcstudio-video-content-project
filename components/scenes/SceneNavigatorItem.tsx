import type { SceneNavigationRow } from "@/lib/scenes/scene-navigation";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import { SceneImageIndicatorBadge } from "@/components/scenes/SceneImageIndicatorBadge";
import { SceneStatusBadge } from "@/components/scenes/SceneStatusBadge";
import { cn } from "@/lib/utils";

/**
 * One scene in the navigator: selects the scene, and copies its narration.
 *
 * The copy control is a **sibling** of the selecting button, not a child of it.
 * A button inside a button is invalid HTML that browsers silently repair by
 * unnesting, and the repair is what would make copying also open the scene. As
 * siblings, the click lands on the copy control alone and the rest of the row
 * stays selectable — which is the behaviour asked for and the only way to get
 * it without hand-rolling click handling on a non-button element.
 */
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
    <div className="relative">
      <Button
        aria-current={selected ? "true" : undefined}
        className={cn(
          // The extra bottom padding is the copy control's seat: without it the
          // icon sits on top of the narration's last line.
          "h-auto w-full items-start justify-start gap-3 rounded-xl border px-3 py-3 pb-8 text-left whitespace-normal",
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
          {/*
            No `block` here. `line-clamp-2` works by setting
            `display: -webkit-box`, and a `display: block` alongside it wins,
            which silently disables the clamp — every scene then printed its
            whole narration and a sixteen-scene list became unscannable.
          */}
          <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">
            {row.version.narrationText}
          </span>
        </span>
      </Button>
      <CopyButton
        className="absolute right-2 bottom-1.5 bg-card/80"
        hideLabel
        label={`scene ${row.scene.sceneNumber} narration`}
        value={row.version.narrationText}
      />
    </div>
  );
}
