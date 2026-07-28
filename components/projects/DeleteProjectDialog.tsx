"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProjectAction } from "@/app/(authenticated)/app/projects/actions";
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

/**
 * Confirms permanent deletion of a project.
 *
 * Spells out what is destroyed rather than saying "this cannot be undone" and
 * leaving the user to guess — publish history in particular is easy to forget
 * about and impossible to reconstruct.
 *
 * On success the server action redirects, so there is no success path to handle
 * here; only a failure returns and is shown inline.
 */
export function DeleteProjectDialog({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={<Button variant="destructive" />}
        aria-label={`Delete project ${projectName}`}
      >
        <Trash2 aria-hidden="true" />
        Delete project
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{projectName}&rdquo;?</DialogTitle>
          <DialogDescription>
            This permanently deletes the project and erases its stored files.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Every scene, script version, and brief</li>
          <li>All generated images, narration audio, and subtitles</li>
          <li>Rendered videos, shorts, and thumbnails</li>
          <li>Publish history for this project</li>
        </ul>
        <p className="text-sm text-muted-foreground">
          Characters and their artwork are shared across projects and are not
          affected.
        </p>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const data = new FormData();
                data.set("projectId", projectId);
                const result = await deleteProjectAction(data);
                // Only reached when deletion failed — success redirects.
                if (result?.error) setError(result.error);
              })
            }
            type="button"
            variant="destructive"
          >
            {pending ? "Deleting…" : "Delete project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
