"use client";

import { useState, useTransition } from "react";
import type { SceneImageActionResult } from "@/lib/scenes/scene-image-view";
import { runSceneImageAction } from "@/lib/scenes/run-scene-image-action";
import { Button } from "@/components/ui/button";

export function ApproveGeneratedImageButton({
  generationId,
  approved,
  disabled,
  onApprove,
}: {
  generationId: string;
  approved: boolean;
  disabled: boolean;
  onApprove: (generationId: string) => Promise<SceneImageActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        disabled={disabled || approved || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await runSceneImageAction(
              () => onApprove(generationId),
              "The image approval could not be completed.",
            );
            setError(result.error);
          })
        }
        size="sm"
        type="button"
      >
        {approved ? "Approved" : pending ? "Approving..." : "Approve image"}
      </Button>
      {error ? (
        <p className="mt-1 max-w-52 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
