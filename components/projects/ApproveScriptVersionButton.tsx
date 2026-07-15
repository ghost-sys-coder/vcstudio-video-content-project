"use client";

import { useState, useTransition } from "react";
import { approveScriptVersionAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { Button } from "@/components/ui/button";

export function ApproveScriptVersionButton({
  projectId,
  versionId,
  approved,
}: {
  projectId: string;
  versionId: string;
  approved: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="text-right">
      <Button
        disabled={pending || approved}
        onClick={() =>
          startTransition(async () => {
            const data = new FormData();
            data.set("projectId", projectId);
            data.set("scriptVersionId", versionId);
            const result = await approveScriptVersionAction(data);
            setError(result.error);
          })
        }
        size="sm"
        type="button"
        variant={approved ? "secondary" : "outline"}
      >
        {approved ? "Approved" : pending ? "Approving…" : "Approve"}
      </Button>
      {error ? (
        <p className="mt-1 max-w-48 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
