"use client";

import Image from "next/image";
import type {
  SceneImageActionResult,
  SceneImageGenerationView,
} from "@/lib/scenes/scene-image-view";
import { formatUsdCents } from "@/lib/format/currency";
import { GeneratedImageActions } from "@/components/scenes/GeneratedImageActions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ImageReviewDialog({
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
  return (
    <Dialog>
      <DialogTrigger
        render={<Button size="sm" type="button" variant="outline" />}
      >
        Review image
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <DialogTitle>
              Generation v{generation.generationVersion}
            </DialogTitle>
            <Badge className="capitalize" variant="secondary">
              {generation.reviewStatus}
            </Badge>
          </div>
          <DialogDescription>
            {generation.stylePresetName} v{generation.stylePresetVersion} /{" "}
            {generation.model} / {generation.quality} / {generation.size}
          </DialogDescription>
        </DialogHeader>
        {generation.imageUrl ? (
          <div className="relative aspect-video overflow-hidden rounded-xl border bg-muted">
            <Image
              alt={`Generated scene image version ${generation.generationVersion}`}
              className="object-contain"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 896px"
              src={generation.imageUrl}
              unoptimized
            />
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Generation record
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-right">{generation.createdAtLabel}</dd>
              <dt className="text-muted-foreground">Template</dt>
              <dd className="text-right">{generation.promptTemplateVersion}</dd>
              <dt className="text-muted-foreground">Format</dt>
              <dd className="text-right uppercase">
                {generation.outputFormat} / {generation.outputCompression}%
              </dd>
              <dt className="text-muted-foreground">References</dt>
              <dd className="text-right">
                {generation.referenceAssetIds.length}
              </dd>
              <dt className="text-muted-foreground">Estimated</dt>
              <dd className="text-right tabular-nums">
                {formatUsdCents(generation.estimatedCostCents)}
              </dd>
              <dt className="text-muted-foreground">Actual</dt>
              <dd className="text-right tabular-nums">
                {generation.actualCostCents === null
                  ? "Pending"
                  : formatUsdCents(generation.actualCostCents)}
              </dd>
            </dl>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Exact prompt
            </p>
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-5">
              {generation.finalPrompt}
            </pre>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="max-w-lg text-xs text-muted-foreground">
            Approving this image atomically replaces the current approval for
            this scene version. Older generations remain in history.
          </p>
          <GeneratedImageActions
            disabled={!canReview}
            generationId={generation.id}
            onApprove={onApprove}
            onReject={onReject}
            reviewStatus={generation.reviewStatus}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
