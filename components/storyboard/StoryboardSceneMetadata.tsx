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
  const cost =
    scene.actualCostCents !== null
      ? `${formatUsdCents(scene.actualCostCents)} actual`
      : scene.estimatedCostCents !== null
        ? `${formatUsdCents(scene.estimatedCostCents)} reserved`
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
        {scene.latestGenerationVersion !== null ? (
          <span>v{scene.latestGenerationVersion}</span>
        ) : null}
      </div>
    </div>
  );
}
