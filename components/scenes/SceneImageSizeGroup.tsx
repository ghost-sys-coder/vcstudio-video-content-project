import type { SceneImageActionResult } from "@/lib/scenes/scene-image-view";
import { getSceneImageSizeLabel } from "@/lib/scenes/scene-image-size-options";
import type { SceneImageSizeGroupView } from "@/lib/scenes/scene-image-grouping";
import { GeneratedImageCard } from "@/components/scenes/GeneratedImageCard";
import { Badge } from "@/components/ui/badge";

export function SceneImageSizeGroup({
  group,
  canReview,
  onApprove,
  onReject,
}: {
  group: SceneImageSizeGroupView;
  canReview: boolean;
  onApprove: (generationId: string) => Promise<SceneImageActionResult>;
  onReject: (generationId: string) => Promise<SceneImageActionResult>;
}) {
  const hasApproved = group.generations.some(
    (generation) => generation.reviewStatus === "approved",
  );

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-medium">
          {getSceneImageSizeLabel(group.size)}{" "}
          <span className="font-normal text-muted-foreground">
            ({group.size})
          </span>
        </h4>
        {hasApproved ? (
          <Badge
            className="border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            variant="outline"
          >
            Approved
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {group.generations.map((generation) => (
          <GeneratedImageCard
            canReview={canReview}
            generation={generation}
            key={generation.id}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}
      </div>
    </section>
  );
}
