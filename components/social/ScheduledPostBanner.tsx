"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, Loader2Icon } from "lucide-react";
import { cancelSocialPostScheduleAction } from "@/app/(authenticated)/app/social/posts/actions";
import { Button } from "@/components/ui/button";

/**
 * Shows when a post is scheduled, and lets it be pulled back.
 *
 * Unscheduling is a plain state change with nothing to revoke — the schedule
 * lives in the database rather than in a delayed background run, which is the
 * whole reason cancelling is this simple.
 */
export function ScheduledPostBanner({
  canPublish,
  postId,
  scheduledAt,
  timezone,
}: {
  canPublish: boolean;
  postId: string;
  scheduledAt: string;
  timezone: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("postId", postId);
      const result = await cancelSocialPostScheduleAction(data);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/30 p-3">
      <p className="flex items-center gap-2 text-sm">
        <CalendarClockIcon aria-hidden className="size-4 shrink-0" />
        <span>
          Scheduled for{" "}
          <time dateTime={scheduledAt}>
            {new Date(scheduledAt).toLocaleString()}
          </time>{" "}
          <span className="text-muted-foreground">(set in {timezone})</span>
        </span>
      </p>
      {error ? (
        <p aria-live="polite" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {canPublish ? (
        <Button
          disabled={pending}
          onClick={cancel}
          size="sm"
          type="button"
          variant="outline"
        >
          {pending ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Cancelling…
            </>
          ) : (
            "Unschedule"
          )}
        </Button>
      ) : null}
    </div>
  );
}
