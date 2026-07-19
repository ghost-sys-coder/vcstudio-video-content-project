"use client";

import { useState, useTransition } from "react";
import { removeCastCharacterAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { Button } from "@/components/ui/button";

export function RemoveCastCharacterButton({
  projectId,
  characterId,
  characterName,
}: {
  projectId: string;
  characterId: string;
  characterName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        aria-label={`Remove ${characterName} from cast`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const data = new FormData();
            data.set("projectId", projectId);
            data.set("characterId", characterId);
            const result = await removeCastCharacterAction(data);
            setError(result.error);
          })
        }
        size="sm"
        variant="ghost"
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
