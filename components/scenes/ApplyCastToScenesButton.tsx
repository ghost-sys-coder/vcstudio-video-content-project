"use client";

import { useState, useTransition } from "react";
import { applyCastToScenesAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ApplyMode = "matched" | "all";

export function ApplyCastToScenesButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ApplyMode>("matched");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    startTransition(async () => {
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("mode", mode);
      const result = await applyCastToScenesAction(data);
      setError(result.error);
      if (result.success) {
        setSummary(
          `Added ${result.assignmentsCreated} assignment${
            result.assignmentsCreated === 1 ? "" : "s"
          } across ${result.scenesAffected} scene${
            result.scenesAffected === 1 ? "" : "s"
          }.`,
        );
      }
    });
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setError(null);
          setSummary(null);
        }
      }}
      open={open}
    >
      <DialogTrigger
        render={<Button disabled={disabled} size="sm" variant="default" />}
      >
        Apply to scenes
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply cast to scenes</DialogTitle>
          <DialogDescription>
            Assign cast characters to the project&apos;s scenes. Existing
            assignments are always preserved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <input
              checked={mode === "matched"}
              name="apply-cast-mode"
              onChange={() => setMode("matched")}
              type="radio"
            />
            <span className="text-sm">
              <span className="font-medium">Matched scenes only</span>
              <span className="block text-xs text-muted-foreground">
                Assign each character only to scenes whose script names them.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <input
              checked={mode === "all"}
              name="apply-cast-mode"
              onChange={() => setMode("all")}
              type="radio"
            />
            <span className="text-sm">
              <span className="font-medium">Every scene</span>
              <span className="block text-xs text-muted-foreground">
                Assign the whole cast to every scene in the project.
              </span>
            </span>
          </label>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {summary ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {summary}
          </p>
        ) : null}
        <DialogFooter showCloseButton>
          <Button disabled={pending} onClick={apply}>
            {pending ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
