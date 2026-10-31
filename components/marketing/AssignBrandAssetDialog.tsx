"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { assignBrandAssetAction } from "@/app/(authenticated)/app/marketing/assets/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMediaLibraryPages } from "@/hooks/useMediaLibraryPages";
import {
  BRAND_ASSET_ROLE_LABELS,
  MARKETING_BRAND_ASSET_ROLES,
} from "@/lib/schemas/marketing-brand-asset";

/**
 * Gives an existing library file a brand role.
 *
 * It picks from the media library rather than uploading: the bytes already have
 * a home, and a second upload path would mean two places to keep in step.
 */
export function AssignBrandAssetDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pages = useMediaLibraryPages("image");
  const library = pages.assets;

  function changeOpen(next: boolean) {
    if (next) {
      setError(null);
      void pages.loadFirst();
    } else pages.cancel();
    setOpen(next);
  }

  function save(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await assignBrandAssetAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger render={<Button variant="outline" />}>
        <PlusIcon />
        Add brand asset
      </DialogTrigger>
      <DialogContent>
        <form action={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a brand asset</DialogTitle>
            <DialogDescription>
              Pick a file already in the media library and say what it is.
            </DialogDescription>
          </DialogHeader>

          {pages.loading && !pages.loaded ? (
            <p role="status">Loading media…</p>
          ) : null}
          {pages.error ? (
            <div role="alert" className="space-y-2">
              <p>{pages.error}</p>
              <Button
                onClick={() => {
                  void (pages.loaded ? pages.loadMore() : pages.loadFirst());
                }}
                type="button"
                variant="outline"
              >
                Try again
              </Button>
            </div>
          ) : null}
          {!pages.loaded ? null : library.length === 0 ? (
            <p className="rounded-lg border border-notice-info-edge bg-notice-info px-2.5 py-2 text-sm text-notice-info-foreground">
              The media library is empty. Upload an image there first — the
              Media library tab is one across.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="brand-asset-media">File</Label>
                <FormSelect id="brand-asset-media" name="mediaAssetId" required>
                  {library.map((asset) => (
                    <SelectItem key={asset.id} value={String(asset.id)}>
                      {asset.title || asset.originalFileName}
                    </SelectItem>
                  ))}
                </FormSelect>
                {pages.nextCursor ? (
                  <Button
                    disabled={pages.loading}
                    onClick={() => {
                      void pages.loadMore();
                    }}
                    type="button"
                    variant="outline"
                  >
                    {pages.loading ? "Loading…" : "Load more images"}
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-asset-role">What is it?</Label>
                <FormSelect
                  defaultValue="logo_primary"
                  id="brand-asset-role"
                  name="role"
                  required
                >
                  {MARKETING_BRAND_ASSET_ROLES.map((role) => (
                    <SelectItem key={role} value={String(role)}>
                      {BRAND_ASSET_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </FormSelect>
                <p className="text-xs text-muted-foreground">
                  Only one file can be the primary logo. Choosing it moves the
                  role off whichever file holds it now.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-asset-notes">Notes</Label>
                <Input
                  id="brand-asset-notes"
                  name="notes"
                  placeholder="Use on dark backgrounds only"
                />
              </div>
            </>
          )}

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose
              disabled={pending}
              render={<Button variant="outline" />}
            >
              Cancel
            </DialogClose>
            <Button disabled={pending || library.length === 0} type="submit">
              {pending ? (
                <>
                  <Loader2Icon aria-hidden className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Add asset"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
