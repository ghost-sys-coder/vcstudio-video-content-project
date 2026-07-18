"use client";

import { useState, useTransition } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AudioReviewHandler,
  SceneAudioActionResult,
} from "@/lib/audio/audio-view";

export function ApproveSceneAudioButton({
  generationId,
  reviewStatus,
  onApprove,
  onReject,
}: {
  generationId: string;
  reviewStatus: "pending" | "approved" | "rejected";
  onApprove: AudioReviewHandler;
  onReject: AudioReviewHandler;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (handler: AudioReviewHandler) =>
    startTransition(async () => {
      setError(null);
      const result: SceneAudioActionResult = await handler(generationId);
      if (!result.success) setError(result.error);
    });

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <Button
          disabled={pending || reviewStatus === "approved"}
          onClick={() => run(onApprove)}
          size="sm"
          type="button"
        >
          <CheckIcon aria-hidden />
          {reviewStatus === "approved" ? "Approved" : "Approve"}
        </Button>
        <Button
          disabled={pending || reviewStatus === "rejected"}
          onClick={() => run(onReject)}
          size="sm"
          type="button"
          variant="outline"
        >
          <XIcon aria-hidden />
          Reject
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
