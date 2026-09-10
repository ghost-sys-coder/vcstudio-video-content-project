"use client";

import {
  useCallback,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import {
  cancelReleaseScheduleAction,
  loadReleaseSchedulesAction,
  scheduleReleaseAction,
} from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import { ReleaseScheduleRow } from "@/components/publish/ReleaseScheduleRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canScheduleReleasePlatform,
  describeUnschedulablePlatform,
} from "@/lib/releases/build-publish-input";
import {
  RELEASE_SCHEDULE_SWEEP_MINUTES,
  validateReleaseSchedule,
} from "@/lib/releases/release-schedule";
import type { ReleaseScheduleListView } from "@/lib/releases/release-schedule-view";
import type { ReleasePackageView } from "@/lib/releases/release-package-view";
import { resolveBrowserTimeZone } from "@/lib/releases/zoned-time";

/**
 * Scheduling a confirmed release, and the schedules already set.
 *
 * The creator chooses a wall-clock time and the zone it is in; the instant is
 * derived on the server, because a browser's clock and zone are not trusted to
 * decide when something publishes. The same check runs here first so a bad time
 * is refused before a round trip.
 *
 * The delivery window is stated plainly rather than implied. A creator who
 * believes a release goes out at exactly 09:00 will read a 09:07 timestamp as
 * a bug, and promising precision the sweeper does not have would be a lie.
 */
export function ReleaseSchedulePanel({
  projectId,
  canManage,
  releasePackage,
  renderId,
  connectionId,
  initialSchedules,
}: {
  projectId: string;
  canManage: boolean;
  releasePackage: ReleasePackageView | null;
  renderId: string | null;
  connectionId: string | null;
  initialSchedules: ReleaseScheduleListView;
}) {
  const [schedules, setSchedules] =
    useState<ReleaseScheduleListView>(initialSchedules);
  const [localDateTime, setLocalDateTime] = useState("");
  const [chosenTimeZone, setChosenTimeZone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The viewer's zone is a client-only fact: reading it during a server render
  // would produce the server's zone and then disagree with the browser on
  // hydration. This yields "UTC" on the server and the real zone on the client,
  // and a creator's own choice overrides both.
  const browserTimeZone = useSyncExternalStore(
    () => () => undefined,
    resolveBrowserTimeZone,
    () => "UTC",
  );
  const timeZone = chosenTimeZone ?? browserTimeZone;

  const refresh = useCallback(async () => {
    const next = await loadReleaseSchedulesAction(projectId);
    if (next) setSchedules(next);
  }, [projectId]);

  const unschedulableReason = releasePackage
    ? describeUnschedulablePlatform(releasePackage.platform)
    : null;
  const schedulable =
    releasePackage !== null &&
    canScheduleReleasePlatform(releasePackage.platform);
  // "ready" means complete and confirmed against the render that is current.
  // "stale" means it was confirmed, but the source content moved underneath it,
  // so scheduling would publish packaging that no longer matches the video.
  const ready = releasePackage?.state.status === "ready";
  const stale = releasePackage?.state.status === "stale";

  const submit = useCallback(() => {
    if (!releasePackage?.id || !renderId || !connectionId) {
      setError("Choose a render and a channel first.");
      return;
    }
    const validated = validateReleaseSchedule({ localDateTime, timeZone });
    if (!validated.ok) {
      setError(validated.message);
      return;
    }
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const result = await scheduleReleaseAction({
        projectId,
        releasePackageId: releasePackage.id,
        renderId,
        connectionId,
        localDateTime,
        timeZone,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setLocalDateTime("");
      setNotice("Scheduled. Nothing has been uploaded yet.");
      await refresh();
    });
  }, [
    connectionId,
    localDateTime,
    projectId,
    refresh,
    releasePackage,
    renderId,
    timeZone,
  ]);

  const cancel = useCallback(
    async (scheduleId: string) => {
      const result = await cancelReleaseScheduleAction({
        projectId,
        scheduleId,
      });
      if (!result.success) setError(result.error);
      await refresh();
    },
    [projectId, refresh],
  );

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-semibold">Schedule this release</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Publishes the confirmed package at a time you choose. The scheduler
          runs every {RELEASE_SCHEDULE_SWEEP_MINUTES} minutes, so a release goes
          out within that window of its time, not to the second.
        </p>
      </div>

      {unschedulableReason ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {unschedulableReason}
        </p>
      ) : null}

      {schedulable && !ready ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {stale
            ? "This package was confirmed against an older render. Reconfirm it before scheduling, or the video and its packaging will not match."
            : "Confirm this release package first. Confirming is what freezes the title, description and thumbnail that will be published."}
        </p>
      ) : null}

      {schedulable && ready ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="release-schedule-at">
              Publish at
            </Label>
            <Input
              className="max-w-xs"
              disabled={!canManage || pending}
              id="release-schedule-at"
              onChange={(event) => {
                setLocalDateTime(event.target.value);
                setNotice(null);
              }}
              type="datetime-local"
              value={localDateTime}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs" htmlFor="release-schedule-zone">
              Time zone
            </Label>
            <Input
              className="max-w-[16rem]"
              disabled={!canManage || pending}
              id="release-schedule-zone"
              onChange={(event) => setChosenTimeZone(event.target.value)}
              placeholder="Africa/Kampala"
              value={timeZone}
            />
          </div>
          <Button
            disabled={!canManage || pending}
            onClick={submit}
            type="button"
          >
            {pending ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-xs text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      {schedules.schedules.length > 0 ? (
        <ul className="space-y-2">
          {schedules.schedules.map((entry) => (
            <ReleaseScheduleRow
              canManage={canManage}
              entry={entry}
              key={entry.id}
              onCancel={cancel}
            />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nothing is scheduled for this project.
        </p>
      )}
    </section>
  );
}
