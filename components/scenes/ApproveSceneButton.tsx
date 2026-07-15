"use client";

import { useState, useTransition } from "react";
import { approveSceneAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { Button } from "@/components/ui/button";

export function ApproveSceneButton({
  projectId,
  sceneId,
  version,
  approved,
  disabled,
}: {
  projectId: string;
  sceneId: string;
  version: number;
  approved: boolean;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        disabled={disabled || approved || pending}
        onClick={() =>
          startTransition(async () => {
            const data = new FormData();
            data.set("projectId", projectId);
            data.set("sceneId", sceneId);
            data.set("expectedVersion", String(version));
            const result = await approveSceneAction(data);
            setError(result.error);
          })
        }
        size="sm"
        type="button"
      >
        {approved ? "Approved" : pending ? "Approving…" : "Approve scene"}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
