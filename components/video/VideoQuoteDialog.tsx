"use client";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { startVideoAction } from "@/app/(authenticated)/app/video/actions";
import type { VideoGenerationRequest } from "@studio/contracts/video";
import { videoMoney } from "@/lib/video-generation/video-composer-options";
export function VideoQuoteDialog({
  workspaceId,
  request,
  quote,
  onClose,
  onStarted,
}: {
  workspaceId: string;
  request: VideoGenerationRequest;
  quote: {
    token: string;
    expiresAt: string;
    maximumCostCents: number;
    durationControl: "strict" | "prompt";
    reservationDurationSeconds: number;
  };
  onClose: () => void;
  onStarted: () => void;
}) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [key] = useState(() => crypto.randomUUID());
  async function start() {
    setPending(true);
    setError(null);
    try {
      const result = await startVideoAction(workspaceId, {
        request,
        quoteToken: quote.token,
        idempotencyKey: key,
      });
      if (!result.ok) setError(result.error);
      else {
        onStarted();
        onClose();
      }
    } catch {
      setError(
        "The request may have been saved. Retry here with the same request key; do not open another generation.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !pending) onClose();
      }}
    >
      <DialogContent showCloseButton={!pending} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review video generation</DialogTitle>
          <DialogDescription>
            Starting this request uses your provider credit. Your estimate
            expires in ten minutes.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border bg-muted/30 p-5">
          <p className="text-sm text-muted-foreground">Reserved estimate</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {videoMoney(quote.maximumCostCents)}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {quote.durationControl === "prompt"
              ? `Duration is prompt-guided. This estimate covers up to ${quote.reservationDurationSeconds} seconds, including an input and thinking allowance.`
              : "The estimate covers the selected clip duration."}{" "}
            Actual provider usage is reconciled after completion.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <dt className="text-muted-foreground">Output</dt>
          <dd className="text-right">
            {request.resolution} · {request.aspectRatio} ·{" "}
            {request.durationSeconds}s
          </dd>
          <dt className="text-muted-foreground">Sound</dt>
          <dd className="text-right">
            {request.target.kind === "scene"
              ? "Existing project narration"
              : request.audio === "native"
                ? "Keep native audio"
                : "No native audio"}
          </dd>
          <dt className="text-muted-foreground">Reference images</dt>
          <dd className="text-right">{request.inputs.length}</dd>
        </dl>
        <p className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-xl border p-3 text-sm">
          {request.prompt}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cancellation is available while queued. Once submitted, the provider
          may charge even if processing fails. Workspace and video spending
          limits apply.
        </p>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button disabled={pending} variant="outline" onClick={onClose}>
            Keep editing
          </Button>
          <Button disabled={pending} onClick={() => void start()}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : null}
            {pending
              ? "Starting video…"
              : `Generate · ${videoMoney(quote.maximumCostCents)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
