import type { StoryboardSceneView } from "@/lib/scenes/storyboard-view";
import { formatUsdCents } from "@/lib/format/currency";

function formatDuration(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

export function StoryboardSceneMetadata({
  scene,
}: {
  scene: StoryboardSceneView;
}) {
  // Summed across every size the scene has generated — actual cost where
  // it's settled, the reservation estimate otherwise.
  const totalCostCents = scene.images.reduce(
    (total, image) =>
      total + (image.actualCostCents ?? image.estimatedCostCents ?? 0),
    0,
  );
  const hasActualCost = scene.images.some(
    (image) => image.actualCostCents !== null,
  );
  const cost =
    totalCostCents > 0
      ? `${formatUsdCents(totalCostCents)} ${hasActualCost ? "actual" : "reserved"}`
      : null;

  return (
    <div className="space-y-2">
      <p className="line-clamp-2 text-sm text-foreground/90">
        {scene.narrationText || "No narration."}
      </p>
      {scene.characterNames.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {scene.characterNames.slice(0, 4).map((name) => (
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              key={name}
            >
              {name}
            </span>
          ))}
          {scene.characterNames.length > 4 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              +{scene.characterNames.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>{formatDuration(scene.durationMilliseconds)}</span>
        {cost ? <span>{cost}</span> : null}
        {scene.images.length > 0 ? (
          <span>
            {scene.images.length} {scene.images.length === 1 ? "size" : "sizes"}
          </span>
        ) : null}
      </div>
    </div>
  );
}
