"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryYouTubeThumbnailAction } from "@/app/(authenticated)/app/social/posts/actions";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2Icon,
  Loader2Icon,
  MinusCircleIcon,
  XCircleIcon,
} from "lucide-react";
import type { SocialPostTargetStatus } from "@/db/schema";
import { formatShortDate } from "@/lib/format/date";
import type { SocialPostTargetView } from "@/lib/social/social-post-view";

const PRESENTATION = {
  pending: {
    icon: MinusCircleIcon,
    className: "text-muted-foreground",
    label: "Not sent yet",
  },
  queued: {
    icon: Loader2Icon,
    className: "text-muted-foreground",
    label: "Queued",
  },
  publishing: {
    icon: Loader2Icon,
    className: "text-muted-foreground",
    label: "Publishing",
  },
  published: {
    icon: CheckCircle2Icon,
    className: "text-emerald-700 dark:text-emerald-500",
    label: "Published",
  },
  failed: { icon: XCircleIcon, className: "text-destructive", label: "Failed" },
  cancelled: {
    icon: MinusCircleIcon,
    className: "text-muted-foreground",
    label: "Cancelled",
  },
  inbox_delivered: {
    icon: CheckCircle2Icon,
    className: "text-amber-700 dark:text-amber-400",
    label: "Delivered to inbox — finish in TikTok",
  },
} as const satisfies Record<
  SocialPostTargetStatus,
  { icon: typeof CheckCircle2Icon; className: string; label: string }
>;

/**
 * One destination's outcome.
 *
 * Every target reports separately, including its own error — a post that reached
 * three platforms and was rejected by a fourth has to say exactly that, rather
 * than collapsing into one status.
 */
export function PostTargetRow({
  target,
  postId,
  version,
  canPublish = false,
}: {
  target: SocialPostTargetView;
  postId?: string;
  version?: number;
  canPublish?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const presentation = PRESENTATION[target.status];
  const Icon = presentation.icon;
  const spinning = target.status === "queued" || target.status === "publishing";

  return (
    <li className="flex items-start gap-2 rounded-lg border p-2 text-sm">
      <Icon
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${presentation.className} ${spinning ? "animate-spin" : ""}`}
      />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="flex flex-wrap items-center gap-x-2">
          <span className="font-medium">{target.platformLabel}</span>
          <span className="truncate text-muted-foreground">
            {target.accountName}
          </span>
        </p>
        <p className={`text-xs ${presentation.className}`}>
          <span className="sr-only">Status: </span>
          {presentation.label}
          {target.publishedAt
            ? ` · ${formatShortDate(target.publishedAt)}`
            : null}
        </p>
        {target.safeErrorMessage ? (
          <p className="text-xs text-destructive">{target.safeErrorMessage}</p>
        ) : null}
        {target.youtubeThumbnailStatus && (
          <div className="space-y-1 text-xs">
            <p>
              Thumbnail:{" "}
              {target.youtubeThumbnailStatus === "pending"
                ? "waiting for YouTube processing"
                : target.youtubeThumbnailStatus}
            </p>
            {target.youtubeThumbnailError && (
              <p className="text-amber-700 dark:text-amber-400">
                {target.youtubeThumbnailError}
              </p>
            )}
            {canPublish &&
              postId &&
              version &&
              target.status === "published" &&
              (target.youtubeThumbnailStatus === "failed" ||
                target.youtubeThumbnailStatus === "unsupported") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const data = new FormData();
                      data.set("postId", postId);
                      data.set("connectionId", target.connectionId);
                      data.set("expectedVersion", String(version));
                      data.set("requestNonce", crypto.randomUUID());
                      const result = await retryYouTubeThumbnailAction(data);
                      if (!result.ok)
                        setError(result.error ?? "Could not retry thumbnail.");
                      else router.refresh();
                    })
                  }
                >
                  {pending ? "Queuing…" : "Retry thumbnail only"}
                </Button>
              )}
            {error && <p role="alert">{error}</p>}
          </div>
        )}
      </div>
      {target.externalPostUrl ? (
        <a
          className="shrink-0 text-xs text-primary underline underline-offset-4"
          href={target.externalPostUrl}
          rel="noreferrer noopener"
          target="_blank"
        >
          View
        </a>
      ) : null}
      {target.status === "inbox_delivered" && (
        <a
          className="shrink-0 text-xs text-primary underline underline-offset-4"
          href="https://www.tiktok.com/"
          target="_blank"
          rel="noreferrer noopener"
        >
          Open TikTok
        </a>
      )}
    </li>
  );
}
