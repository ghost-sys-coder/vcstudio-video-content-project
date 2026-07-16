"use client";

import { useState, useTransition } from "react";
import type { SceneImageActionResult } from "@/lib/scenes/scene-image-view";
import { runSceneImageAction } from "@/lib/scenes/run-scene-image-action";
import { Button } from "@/components/ui/button";

export function RejectGeneratedImageButton({
  generationId,
  rejected,
  disabled,
  onReject,
}: {
  generationId: string;
  rejected: boolean;
  disabled: boolean;
  onReject: (generationId: string) => Promise<SceneImageActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        disabled={disabled || rejected || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await runSceneImageAction(
              () => onReject(generationId),
              "The image rejection could not be completed.",
            );
            setError(result.error);
          })
        }
        size="sm"
        type="button"
        variant="outline"
      >
        {rejected ? "Rejected" : pending ? "Rejecting..." : "Reject image"}
      </Button>
      {error ? (
        <p className="mt-1 max-w-52 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
