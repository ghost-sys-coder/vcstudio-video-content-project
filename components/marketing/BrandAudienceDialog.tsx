"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { saveBrandAudienceAction } from "@/app/(authenticated)/app/marketing/brand/actions";
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
import { Textarea } from "@/components/ui/textarea";
import type { MarketingBrandAudience } from "@/db/schema";

/**
 * Creates or edits one audience.
 *
 * Controlled `open` on the established pattern: a failed save keeps the dialog
 * open with the error inside it, and it closes only once the server accepted.
 */
export function BrandAudienceDialog({
  audience,
}: {
  audience?: MarketingBrandAudience;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    if (next) setError(null);
    setOpen(next);
  }

  function save(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveBrandAudienceAction(formData);
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
      <DialogTrigger
        render={<Button size={audience ? "sm" : "default"} variant="outline" />}
      >
        {audience ? null : <PlusIcon />}
        {audience ? "Edit" : "Add audience"}
      </DialogTrigger>
      <DialogContent>
        <form action={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {audience ? "Edit audience" : "Add an audience"}
            </DialogTitle>
            <DialogDescription>
              Who you are trying to reach. The primary audience is the one the
              studio writes for by default.
            </DialogDescription>
          </DialogHeader>

          {audience ? (
            <input name="audienceId" type="hidden" value={audience.id} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="audience-name">Name</Label>
            <Input
              defaultValue={audience?.name ?? ""}
              id="audience-name"
              name="name"
              placeholder="Solo creators"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience-description">Description</Label>
            <Textarea
              defaultValue={audience?.description ?? ""}
              id="audience-description"
              name="description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience-pains">Pain points</Label>
            <Textarea
              defaultValue={(audience?.painPoints ?? []).join("\n")}
              id="audience-pains"
              name="painPoints"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">One per line.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience-triggers">Buying triggers</Label>
            <Textarea
              defaultValue={(audience?.buyingTriggers ?? []).join("\n")}
              id="audience-triggers"
              name="buyingTriggers"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">One per line.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="audience-geography">Geography</Label>
            <Input
              defaultValue={audience?.geography ?? ""}
              id="audience-geography"
              name="geography"
            />
          </div>

          <Label className="flex items-start gap-2 text-sm">
            <input
              className="mt-1"
              defaultChecked={audience?.isPrimary ?? false}
              name="isPrimary"
              type="checkbox"
            />
            <span>
              <span className="block">Primary audience</span>
              <span className="block text-xs text-muted-foreground">
                Setting this moves it off whichever audience holds it now.
              </span>
            </span>
          </Label>

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
            <Button disabled={pending} type="submit">
              {pending ? (
                <>
                  <Loader2Icon aria-hidden className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save audience"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
