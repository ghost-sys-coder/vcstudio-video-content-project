"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClockIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
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
import type { SocialPostPlatform } from "@/lib/social/platform-post-capabilities";

/**
 * Schedules the post for later.
 *
 * The picker works in the viewer's own local time and the browser's timezone is
 * sent alongside the instant — the server stores an absolute `timestamptz`, and
 * the zone is kept only so the schedule can be redisplayed the way it was meant.
 *
 * `open` is controlled rather than left to the dialog, for the same reason the
 * workspace confirmation dialogs control theirs: a failure has to keep the
 * dialog open and report the error where the user acted, while a success has to
 * close it — otherwise the scheduled-post banner the refresh reveals is hidden
 * behind the dialog that is still covering it.
 */
export function SchedulePostDialog({
  disabled,
  postId,
  scheduledAt,
  selectedConnectionIds,
  captionOverrides,
}: {
  disabled: boolean;
  postId: string;
  scheduledAt: string | null;
  selectedConnectionIds: string[];
  captionOverrides: { platform: SocialPostPlatform; text: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(() =>
    toDateTimeLocalValue(
      scheduledAt
        ? new Date(scheduledAt)
        : new Date(Date.now() + 60 * 60 * 1000),
    ),
  );
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function changeOpen(next: boolean) {
    // Clearing on open means a previous failure never greets the next attempt.
    if (next) setError(null);
    setOpen(next);
  }

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
      data.set("captionOverrides", JSON.stringify(captionOverrides));

      const result = await scheduleSocialPostAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      // The instant comes back from the server rather than being echoed from the
      // picker, so the confirmation states what was actually stored.
      toast.success(
        `Scheduled for ${new Date(result.scheduledAt).toLocaleString()}.`,
      );
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
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
          <DialogClose disabled={pending} render={<Button variant="outline" />}>
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
