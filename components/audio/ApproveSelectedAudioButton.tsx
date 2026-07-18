"use client";

import { useState, useTransition } from "react";
import { CheckCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SceneAudioActionResult } from "@/lib/audio/audio-view";

export function ApproveSelectedAudioButton({
  count,
  disabled,
  onApproveSelected,
}: {
  count: number;
  disabled: boolean;
  onApproveSelected: () => Promise<SceneAudioActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={disabled || count === 0 || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await onApproveSelected();
            if (!result.success) setError(result.error);
          })
        }
        type="button"
        variant="outline"
      >
        <CheckCheckIcon aria-hidden />
        {pending ? "Approving…" : `Approve ${count > 0 ? `(${count})` : ""}`}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
