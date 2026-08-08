"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSocialPostAction } from "@/app/(authenticated)/app/social/posts/actions";
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

export function DeleteDraftPostDialog({
  postId,
  postName,
}: {
  postId: string;
  postName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const displayName = postName.trim() === "" ? "Untitled post" : postName;

  function handleOpenChange(nextOpen: boolean) {
    if (pending) return;
    setOpen(nextOpen);
    if (nextOpen) setError(null);
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("postId", postId);
      const result = await deleteSocialPostAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      toast.success("Draft deleted");
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label={`Delete draft ${displayName}`}
            size="icon-sm"
            title={`Delete draft ${displayName}`}
            variant="ghost"
          />
        }
      >
        <Trash2Icon aria-hidden />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{displayName}&rdquo;?</DialogTitle>
          <DialogDescription>
            This permanently deletes the draft. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p aria-live="polite" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose disabled={pending} render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            onClick={remove}
            type="button"
            variant="destructive"
          >
            {pending ? (
              <>
                <Loader2Icon aria-hidden className="animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete draft"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
