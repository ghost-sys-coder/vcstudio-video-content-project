"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { removeBrandAssetAction } from "@/app/(authenticated)/app/marketing/assets/actions";
import { Button } from "@/components/ui/button";
import type { BrandAssetView } from "@/lib/marketing/documents/documents-view";
import { BRAND_ASSET_ROLE_LABELS } from "@/lib/schemas/marketing-brand-asset";

export function BrandAssetCard({ asset }: { asset: BrandAssetView }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("brandAssetId", asset.id);
      const result = await removeBrandAssetAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="space-y-2 rounded-xl border p-2">
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted">
        {asset.kind === "image" ? (
          // Signed R2 URLs are per-request and not a configured image host, so
          // next/image would need a remote pattern for a URL that changes every
          // request. A plain img is the honest choice here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={asset.title}
            className="max-h-full max-w-full object-contain"
            src={asset.previewUrl}
          />
        ) : (
          <span className="text-xs text-muted-foreground">Video</span>
        )}
      </div>

      <p className="truncate text-sm font-medium">{asset.title}</p>
      <p className="text-xs text-muted-foreground">
        {BRAND_ASSET_ROLE_LABELS[asset.role]}
      </p>
      {asset.notes ? (
        <p className="text-xs text-muted-foreground">{asset.notes}</p>
      ) : null}

      <Button
        className="w-full"
        disabled={pending}
        onClick={remove}
        size="sm"
        type="button"
        variant="ghost"
      >
        {pending ? (
          <Loader2Icon aria-hidden className="animate-spin" />
        ) : (
          "Remove role"
        )}
      </Button>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
