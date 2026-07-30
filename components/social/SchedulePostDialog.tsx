"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, Loader2Icon } from "lucide-react";
import { scheduleSocialPostAction } from "@/app/(authenticated)/app/social/posts/actions";
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
import {
  MINIMUM_SCHEDULE_LEAD_SECONDS,
  toDateTimeLocalValue,
} from "@/lib/social/schedule-window";

/**
 * Schedules the post for later.
 *
 * The picker works in the viewer's own local time and the browser's timezone is
 * sent alongside the instant — the server stores an absolute `timestamptz`, and
 * the zone is kept only so the schedule can be redisplayed the way it was meant.
 */
export function SchedulePostDialog({
  disabled,
  postId,
  scheduledAt,
  selectedConnectionIds,
}: {
  disabled: boolean;
  postId: string;
  scheduledAt: string | null;
  selectedConnectionIds: string[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(() =>
    toDateTimeLocalValue(
      scheduledAt
        ? new Date(scheduledAt)
        : new Date(Date.now() + 60 * 60 * 1000),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function schedule() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("postId", postId);
      // A `datetime-local` value has no offset, so `new Date` reads it as local
      // time — which is what the author meant — and `toISOString` turns it into
      // the absolute instant the server stores.
      data.set("scheduledAt", new Date(value).toISOString());
      data.set(
        "timezone",
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      );
      for (const id of selectedConnectionIds) data.append("connectionIds", id);
      data.set("requestNonce", crypto.randomUUID());

      const result = await scheduleSocialPostAction(data);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button disabled={disabled} variant="outline" />}>
        <CalendarClockIcon />
        Schedule
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule this post</DialogTitle>
          <DialogDescription>
            It goes out on its own, to the accounts selected above. Scheduling
            saves the destinations now, so a problem surfaces while you are
            still here rather than at send time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="schedule-at">Send at (your local time)</Label>
          <Input
            id="schedule-at"
            onChange={(event) => setValue(event.target.value)}
            type="datetime-local"
            value={value}
          />
          <p className="text-xs text-muted-foreground">
            At least {MINIMUM_SCHEDULE_LEAD_SECONDS / 60} minutes ahead. Posts
            go out within about a minute of the chosen time.
          </p>
        </div>

        {error ? (
          <p aria-live="polite" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending || selectedConnectionIds.length === 0}
            onClick={schedule}
            type="button"
          >
            {pending ? (
              <>
                <Loader2Icon aria-hidden className="animate-spin" />
                Scheduling…
              </>
            ) : (
              "Schedule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
