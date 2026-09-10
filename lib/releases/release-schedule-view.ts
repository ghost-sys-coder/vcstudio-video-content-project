import type { ReleaseSchedule } from "@/db/schema";
import { toVideoContentPlatform } from "@/lib/platforms/video-content-platforms";
import type { VideoContentPlatform } from "@/lib/platforms/video-content-platforms";
import {
  canCancelReleaseSchedule,
  describeScheduledRelease,
  isReleaseScheduleOverdue,
  RELEASE_SCHEDULE_STATE_LABELS,
  type ReleaseScheduleState,
} from "@/lib/releases/release-schedule";

const PLATFORM_LABELS: Record<VideoContentPlatform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

export interface ReleaseScheduleEntryView {
  id: string;
  releasePackageId: string;
  renderId: string;
  connectionId: string;
  platform: VideoContentPlatform;
  platformLabel: string;
  state: ReleaseScheduleState;
  stateLabel: string;
  /** The instant, for anything that needs to compare or re-render it. */
  scheduledAtIso: string;
  /** The wall-clock time in the zone it was written in, with that zone named. */
  scheduledLabel: string;
  timeZone: string;
  /** Past its time and still waiting, so the delay is visible rather than hidden. */
  overdue: boolean;
  canCancel: boolean;
  safeErrorMessage: string | null;
  publicationId: string | null;
}

export interface ReleaseScheduleListView {
  schedules: ReleaseScheduleEntryView[];
}

/**
 * Presents stored schedules for the publish panel.
 *
 * Every row carries the zone it was written in, because the same instant is a
 * different day in a different zone and a bare time would be exactly the
 * ambiguity the stored zone exists to remove.
 */
export function toReleaseScheduleListView(
  rows: ReleaseSchedule[],
  now: Date = new Date(),
): ReleaseScheduleListView {
  return {
    schedules: rows.map((row) => {
      const state = row.status as ReleaseScheduleState;
      const platform = toVideoContentPlatform(row.platform);
      return {
        id: row.id,
        releasePackageId: row.releasePackageId,
        renderId: row.renderId,
        connectionId: row.connectionId,
        platform,
        platformLabel: PLATFORM_LABELS[platform],
        state,
        stateLabel: RELEASE_SCHEDULE_STATE_LABELS[state],
        scheduledAtIso: row.scheduledAt.toISOString(),
        scheduledLabel: describeScheduledRelease({
          scheduledAt: row.scheduledAt,
          timeZone: row.timeZone,
        }),
        timeZone: row.timeZone,
        overdue: isReleaseScheduleOverdue({
          state,
          scheduledAt: row.scheduledAt,
          now,
        }),
        canCancel: canCancelReleaseSchedule(state),
        safeErrorMessage: row.safeErrorMessage,
        publicationId: row.publicationId,
      };
    }),
  };
}
