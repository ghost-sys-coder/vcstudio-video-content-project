"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { deleteBrandOfferAction } from "@/app/(authenticated)/app/marketing/brand/actions";
import { BrandOfferDialog } from "@/components/marketing/BrandOfferDialog";
import { Button } from "@/components/ui/button";
import type { MarketingBrandAudience, MarketingBrandOffer } from "@/db/schema";

export function BrandOfferRow({
  audienceName,
  audiences,
  offer,
}: {
  audienceName: string | null;
  audiences: MarketingBrandAudience[];
  offer: MarketingBrandOffer;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("id", offer.id);
      const result = await deleteBrandOfferAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="space-y-2 rounded-xl border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{offer.name}</p>
          {offer.summary ? (
            <p className="text-xs text-muted-foreground">{offer.summary}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BrandOfferDialog audiences={audiences} offer={offer} />
          <Button
            disabled={pending}
            onClick={remove}
            size="sm"
            type="button"
            variant="ghost"
          >
            {pending ? (
              <Loader2Icon aria-hidden className="animate-spin" />
            ) : (
              "Remove"
            )}
          </Button>
        </div>
      </div>

      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
        {offer.priceModel ? <span>{offer.priceModel}</span> : null}
        {audienceName ? <span>For {audienceName}</span> : null}
      </p>

      {offer.differentiators.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Why us: </span>
          {offer.differentiators.join(" · ")}
        </p>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
