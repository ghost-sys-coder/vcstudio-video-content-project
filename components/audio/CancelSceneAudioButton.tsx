"use client";

import { useState, useTransition } from "react";
import { XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AudioReviewHandler } from "@/lib/audio/audio-view";

export function CancelSceneAudioButton({
  generationId,
  onCancel,
}: {
  generationId: string;
  onCancel: AudioReviewHandler;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await onCancel(generationId);
            if (!result.success) setError(result.error);
          })
        }
        size="sm"
        type="button"
        variant="outline"
      >
        <XCircleIcon aria-hidden />
        {pending ? "Cancelling…" : "Cancel"}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
