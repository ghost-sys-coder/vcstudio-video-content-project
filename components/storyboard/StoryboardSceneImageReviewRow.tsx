"use client";

import { useState, useTransition } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  StoryboardReviewHandler,
  StoryboardSceneImageView,
} from "@/lib/scenes/storyboard-view";
import { getSceneImageSizeLabel } from "@/lib/scenes/scene-image-size-options";

/** Approve/reject actions for one size's pending generation. */
export function StoryboardSceneImageReviewRow({
  image,
  onApprove,
  onReject,
}: {
  image: StoryboardSceneImageView;
  onApprove: StoryboardReviewHandler;
  onReject: StoryboardReviewHandler;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const runReview = (handler: StoryboardReviewHandler) => {
    if (!image.latestGenerationId) return;
    const generationId = image.latestGenerationId;
    startTransition(async () => {
      setError(null);
      const result = await handler(generationId);
      if (!result.success) setError(result.error);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        {getSceneImageSizeLabel(image.size)}
      </span>
      <Button
        disabled={pending}
        onClick={() => runReview(onApprove)}
        size="sm"
        type="button"
      >
        <CheckIcon aria-hidden />
        Approve
      </Button>
      <Button
        disabled={pending}
        onClick={() => runReview(onReject)}
        size="sm"
        type="button"
        variant="outline"
      >
        <XIcon aria-hidden />
        Reject
      </Button>
      {error ? (
        <p className="w-full text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
