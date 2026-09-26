"use client";

import { useState, useTransition } from "react";
import { ClipboardPasteIcon } from "lucide-react";
import { importScenesAction } from "@/app/(authenticated)/app/projects/[projectId]/scenes/actions";
import { SceneTemplatePanel } from "@/components/scenes/SceneTemplatePanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Brings a plan written elsewhere into the project.
 *
 * Takes one scene or a whole list, and reads the field names people actually
 * write — `narration` as readily as `narrationText` — so an existing file does
 * not have to be rewritten to be accepted.
 *
 * The paste is kept on a refusal rather than cleared. A creator who has just
 * been told scene fourteen is missing its camera angle needs the text still
 * there to fix it, and emptying the box would make the error a punishment.
 */
export function ImportScenesDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  function reset() {
    setError(null);
    setIssues([]);
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
      open={open}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <ClipboardPasteIcon aria-hidden className="size-4" />
        Paste scenes
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste scenes</DialogTitle>
          <DialogDescription>
            Add one scene or a whole plan at once. Nothing is created unless
            every scene in the paste is complete, so a mistake halfway down the
            list leaves the project untouched.
          </DialogDescription>
        </DialogHeader>

        <SceneTemplatePanel
          onUseTemplate={(template) => {
            setPasted(template);
            reset();
          }}
        />

        <div className="space-y-2">
          <Label htmlFor="import-scenes-json">Scene JSON</Label>
          <Textarea
            className="min-h-48 font-mono text-xs"
            disabled={pending}
            id="import-scenes-json"
            onChange={(event) => {
              setPasted(event.target.value);
              reset();
            }}
            placeholder='{ "narrationText": "…" } or [ { … }, { … } ]'
            value={pasted}
          />
        </div>

        {error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
            {issues.length > 0 ? (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending || pasted.trim().length === 0}
            onClick={() => {
              reset();
              const data = new FormData();
              data.set("projectId", projectId);
              data.set("pasted", pasted);
              startTransition(async () => {
                try {
                  const result = await importScenesAction(data);
                  if (!result.success) {
                    setError(result.error ?? "The scenes could not be added.");
                    setIssues(result.issues ?? []);
                    return;
                  }
                  window.location.assign(`/app/projects/${projectId}/scenes`);
                } catch {
                  setError(
                    "The request could not complete. Your paste is still here; try again.",
                  );
                }
              });
            }}
            type="button"
          >
            {pending ? "Adding…" : "Add scenes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
