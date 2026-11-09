"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteSocialPostAction,
  getPostDeletionPreviewAction,
} from "@/app/(authenticated)/app/social/posts/actions";
import type { PostDeletionPreview } from "@studio/contracts/publishing";
import { Checkbox } from "@/components/ui/Checkbox";
import { Label } from "@/components/ui/label";
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

export function DeletePostDialog({
  postId,
  postName,
  redirectTo,
  showLabel = false,
  disabled = false,
}: {
  postId: string;
  postName: string;
  redirectTo?: string;
  showLabel?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PostDeletionPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteMedia, setDeleteMedia] = useState(false);
  const loadingVersion = useRef(0);
  const busy = useRef(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const displayName = postName.trim() === "" ? "Untitled post" : postName;

  function handleOpenChange(nextOpen: boolean) {
    if (busy.current) return;
    setOpen(nextOpen);
    if (nextOpen) {
      setPreview(null);
      setDeleteMedia(false);
      void loadDetails();
    } else loadingVersion.current++;
  }

  async function loadDetails() {
    const version = ++loadingVersion.current;
    setLoading(true);
    setPreview(null);
    setError(null);
    try {
      const result = await getPostDeletionPreviewAction(postId);
      if (version !== loadingVersion.current) return;
      if (result.ok) {
        setPreview(result.preview);
        setDeleteMedia(false);
      } else setError(result.error);
    } catch {
      if (version === loadingVersion.current)
        setError("The deletion details could not be loaded. Try again.");
    } finally {
      if (version === loadingVersion.current) setLoading(false);
    }
  }

  function remove() {
    if (busy.current || !preview?.canDelete || loading) return;
    busy.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set("postId", postId);
        data.set("expectedVersion", String(preview.version));
        data.set("deleteMedia", String(deleteMedia));
        const result = await deleteSocialPostAction(data);
        if (!result.ok) {
          setError(result.error);
          return;
        }

        setOpen(false);
        toast.success(
          result.removedMediaCount > 0
            ? `Post deleted. ${result.removedMediaCount} media file${result.removedMediaCount === 1 ? "" : "s"} removed from the library.`
            : "Post deleted",
        );
        if (redirectTo) router.replace(redirectTo);
        else router.refresh();
      } catch {
        setError(
          "The post could not be deleted. Your choices are still here; try again.",
        );
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger
        render={
          <Button
            aria-label={`Delete post ${displayName}`}
            disabled={disabled}
            size={showLabel ? "sm" : "icon-sm"}
            title={`Delete post ${displayName}`}
            variant={showLabel ? "outline" : "ghost"}
          />
        }
      >
        <Trash2Icon aria-hidden />
        {showLabel ? "Delete post" : null}
      </DialogTrigger>
      <DialogContent initialFocus={cancelRef} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{displayName}&rdquo;?</DialogTitle>
          <DialogDescription>
            Delete this post and its VCStudio publishing history. This cannot be
            undone. Copies already published on social channels will remain
            there.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2Icon aria-hidden className="size-4 animate-spin" />
            Loading deletion details…
          </p>
        ) : null}
        {preview?.status === "scheduled" ? (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm">
            Deleting this post also cancels its schedule.
          </p>
        ) : null}
        {preview && !preview.canDelete ? (
          <p role="status" className="text-sm text-muted-foreground">
            Publishing work is in progress for this post. Wait for it to finish,
            then reload these details.
          </p>
        ) : null}
        {preview && preview.mediaCount > 0 ? (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`delete-post-media-${postId}`}
                checked={deleteMedia}
                onCheckedChange={(value) => setDeleteMedia(value === true)}
                disabled={
                  pending || loading || preview.removableMediaCount === 0
                }
              />
              <Label
                htmlFor={`delete-post-media-${postId}`}
                className="leading-5"
              >
                Also delete attached media from the library
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {preview.removableMediaCount} saved media file
              {preview.removableMediaCount === 1 ? "" : "s"} can be removed.
              Shared media and project-owned renders are kept. Leave unchecked
              to keep the media.
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {error || (preview && !preview.canDelete) ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || loading}
            onClick={() => void loadDetails()}
          >
            Reload deletion details
          </Button>
        ) : null}
        <DialogFooter>
          <DialogClose
            disabled={pending}
            render={<Button ref={cancelRef} variant="outline" />}
          >
            Cancel
          </DialogClose>
          <Button
            disabled={pending || loading || !preview?.canDelete}
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
              "Delete post"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
