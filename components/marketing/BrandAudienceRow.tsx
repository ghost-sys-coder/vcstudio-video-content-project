"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, StarIcon } from "lucide-react";
import { deleteBrandAudienceAction } from "@/app/(authenticated)/app/marketing/brand/actions";
import { BrandAudienceDialog } from "@/components/marketing/BrandAudienceDialog";
import { Button } from "@/components/ui/button";
import type { MarketingBrandAudience } from "@/db/schema";

export function BrandAudienceRow({
  audience,
}: {
  audience: MarketingBrandAudience;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("id", audience.id);
      const result = await deleteBrandAudienceAction(data);
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
          <p className="flex items-center gap-2 text-sm font-medium">
            {audience.name}
            {audience.isPrimary ? (
              <span className="flex items-center gap-1 rounded-md border border-notice-ready-edge bg-notice-ready px-1.5 py-0.5 text-xs text-notice-ready-foreground">
                <StarIcon aria-hidden className="size-3" />
                Primary
              </span>
            ) : null}
          </p>
          {audience.description ? (
            <p className="text-xs text-muted-foreground">
              {audience.description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BrandAudienceDialog audience={audience} />
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

      {audience.painPoints.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Pain points: </span>
          {audience.painPoints.join(" · ")}
        </p>
      ) : null}
      {audience.geography ? (
        <p className="text-xs text-muted-foreground">{audience.geography}</p>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
