"use client";

import { useRef, useState, useTransition } from "react";
import { ImageIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  requestVideoThumbnailAction,
  checkVideoThumbnailAction,
} from "@/app/(authenticated)/app/social/video-thumbnail-actions";
import type { MediaAssetView } from "@/lib/media/media-asset-view";

export function VideoThumbnailAction({
  asset,
  onUpdated,
}: {
  asset: MediaAssetView;
  onUpdated: (asset: MediaAssetView) => void;
}) {
  const [proof, setProof] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const busy = useRef(false);
  if (asset.thumbnailUrl) return null;
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm text-muted-foreground">
        Create a small preview from this video. Your original file stays
        unchanged.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (busy.current) return;
          busy.current = true;
          startTransition(async () => {
            try {
              requestId.current ??= crypto.randomUUID();
              const result = proof
                ? await checkVideoThumbnailAction(proof)
                : await requestVideoThumbnailAction({
                    mediaAssetId: asset.id,
                    requestId: requestId.current,
                  });
              if (result.status === "ready") {
                onUpdated(result.asset);
                setMessage(null);
                setProof(null);
              } else if (result.status === "pending") {
                setProof(result.proof);
                setMessage(
                  "Thumbnail requested. Check status shortly to load the preview.",
                );
              } else {
                setProof(null);
                requestId.current = null;
                setMessage(result.error);
              }
            } catch {
              setMessage("The request could not finish. Try again shortly.");
            } finally {
              busy.current = false;
            }
          });
        }}
      >
        {pending ? <Loader2Icon className="animate-spin" /> : <ImageIcon />}
        {pending
          ? "Working…"
          : proof
            ? "Check thumbnail status"
            : "Create video thumbnail"}
      </Button>
      {message ? (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      ) : null}
    </div>
  );
}
