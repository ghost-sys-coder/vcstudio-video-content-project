import Image from "next/image";
import type {
  SceneImageActionResult,
  SceneImageGenerationView,
} from "@/lib/scenes/scene-image-view";
import { formatUsdCents } from "@/lib/format/currency";
import { ImageGenerationErrorState } from "@/components/scenes/ImageGenerationErrorState";
import { ImageReviewDialog } from "@/components/scenes/ImageReviewDialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function GeneratedImageCard({
  generation,
  canReview,
  onApprove,
  onReject,
}: {
  generation: SceneImageGenerationView;
  canReview: boolean;
  onApprove: (generationId: string) => Promise<SceneImageActionResult>;
  onReject: (generationId: string) => Promise<SceneImageActionResult>;
}) {
  const succeeded = generation.status === "succeeded";

  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Generation v{generation.generationVersion}</CardTitle>
          <div className="flex flex-wrap gap-1">
            <Badge
              className={cn(
                "capitalize",
                generation.status === "succeeded" &&
                  "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                generation.status === "failed" &&
                  "border-destructive/30 bg-destructive/10 text-destructive",
              )}
              variant="outline"
            >
              {generation.status}
            </Badge>
            {succeeded ? (
              <Badge
                className={cn(
                  "capitalize",
                  generation.reviewStatus === "approved" &&
                    "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
                  generation.reviewStatus === "rejected" &&
                    "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
                )}
                variant="outline"
              >
                {generation.reviewStatus}
              </Badge>
            ) : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {generation.createdAtLabel} / {generation.quality} / {generation.size}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {generation.imageUrl ? (
          <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
            <Image
              alt={`Generated scene image version ${generation.generationVersion}`}
              className="object-contain"
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              src={generation.imageUrl}
              unoptimized
            />
          </div>
        ) : generation.status === "failed" ? (
          <ImageGenerationErrorState
            generationVersion={generation.generationVersion}
            reservationReleased={generation.reservationReleased}
            safeErrorMessage={generation.safeErrorMessage}
          />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed bg-muted/30 p-6 text-center text-xs text-muted-foreground">
            The generated image will appear here after the background task
            completes.
          </div>
        )}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            <p>
              {generation.stylePresetName} v{generation.stylePresetVersion}
            </p>
            <p className="mt-1 tabular-nums">
              {generation.actualCostCents === null
                ? `${formatUsdCents(generation.estimatedCostCents)} reserved`
                : `${formatUsdCents(generation.actualCostCents)} actual`}
            </p>
          </div>
          {succeeded && generation.imageUrl ? (
            <ImageReviewDialog
              canReview={canReview}
              generation={generation}
              onApprove={onApprove}
              onReject={onReject}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
