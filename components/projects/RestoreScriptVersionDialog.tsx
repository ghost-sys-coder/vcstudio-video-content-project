"use client";

import { useState, useTransition } from "react";
import { restoreScriptVersionAction } from "@/app/(authenticated)/app/projects/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RestoreScriptVersionDialog({
  projectId,
  versionId,
  versionNumber,
  revision,
  onRestored,
}: {
  projectId: string;
  versionId: string;
  versionNumber: number;
  revision: number;
  onRestored: (revision: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Restore
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restore version {versionNumber}?</DialogTitle>
          <DialogDescription>
            The historical version remains immutable. Its content will become
            the draft and a new latest version.
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const data = new FormData();
              data.set("projectId", projectId);
              data.set("versionId", versionId);
              data.set("revision", String(revision));
              const result = await restoreScriptVersionAction(data);
              if (result.success && result.revision !== undefined)
                onRestored(result.revision);
              else setError(result.error);
            })
          }
        >
          {pending ? "Restoring…" : "Restore as new version"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
