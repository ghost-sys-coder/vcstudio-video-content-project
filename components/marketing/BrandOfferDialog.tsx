"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { saveBrandOfferAction } from "@/app/(authenticated)/app/marketing/brand/actions";
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
import type { MarketingBrandAudience, MarketingBrandOffer } from "@/db/schema";

export function BrandOfferDialog({
  audiences,
  offer,
}: {
  audiences: MarketingBrandAudience[];
  offer?: MarketingBrandOffer;
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
      const result = await saveBrandOfferAction(formData);
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
        render={<Button size={offer ? "sm" : "default"} variant="outline" />}
      >
        {offer ? null : <PlusIcon />}
        {offer ? "Edit" : "Add offer"}
      </DialogTrigger>
      <DialogContent>
        <form action={save} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{offer ? "Edit offer" : "Add an offer"}</DialogTitle>
            <DialogDescription>
              Something you sell, and why someone picks it over the alternative.
            </DialogDescription>
          </DialogHeader>

          {offer ? (
            <input name="offerId" type="hidden" value={offer.id} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="offer-name">Name</Label>
            <Input
              defaultValue={offer?.name ?? ""}
              id="offer-name"
              name="name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-summary">Summary</Label>
            <Textarea
              defaultValue={offer?.summary ?? ""}
              id="offer-summary"
              name="summary"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-price">Price model</Label>
            <Input
              defaultValue={offer?.priceModel ?? ""}
              id="offer-price"
              name="priceModel"
              placeholder="Monthly subscription, from $29"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-audience">Audience</Label>
            {/*
              A native select rather than the shadcn one: it lives inside a form
              posted as FormData, and the native element needs no hidden-input
              bridge to be submitted.
            */}
            <select
              className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              defaultValue={offer?.audienceId ?? ""}
              id="offer-audience"
              name="audienceId"
            >
              <option value="">Not audience-specific</option>
              {audiences.map((audience) => (
                <option key={audience.id} value={audience.id}>
                  {audience.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="offer-differentiators">Differentiators</Label>
            <Textarea
              defaultValue={(offer?.differentiators ?? []).join("\n")}
              id="offer-differentiators"
              name="differentiators"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">One per line.</p>
          </div>

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
                "Save offer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
