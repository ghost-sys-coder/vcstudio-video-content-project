import { schedules } from "@trigger.dev/sdk";
import {
  claimDueReleaseSchedules,
  markReleaseScheduleDispatched,
  markReleaseScheduleFailed,
} from "@/db/commands/release-schedule-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { findReleasePackage } from "@/db/repositories/release-packages.repository";
import { getPublishingEnvironment } from "@/lib/env/server";
import { buildScheduledPublishInput } from "@/lib/releases/build-publish-input";
import { startVideoPublication } from "@/lib/publishing/start-video-publication";
import { toVideoContentPlatform } from "@/lib/platforms/video-content-platforms";

/**
 * Sends the releases whose scheduled time has arrived.
 *
 * **Why a sweeper rather than Trigger's `delay`.** `AGENTS.md` requires
 * PostgreSQL to be authoritative and forbids background workflow state from
 * being the only source of truth. With the schedule in the database:
 * rescheduling and cancelling are plain updates with nothing to revoke; a
 * dropped, expired or cancelled delayed run cannot orphan a release; and a
 * release scheduled while the worker was down still goes out once it returns.
 * The cost is up to one interval of jitter, which the interface states rather
 * than hides. This mirrors the social-post scheduler deliberately, so there is
 * one scheduling pattern in the codebase rather than two.
 *
 * Claiming is atomic, so two workers, or a sweep overlapping a slow previous
 * one, cannot dispatch the same release twice. The publish request carries the
 * schedule's own id as its nonce, so even a repeated dispatch resolves to the
 * same idempotency key rather than a second upload.
 */
export const releaseSchedulerTask = schedules.task({
  id: "release-scheduler",
  // Matches the social scheduler. A small delivery delay is preferable to
  // keeping the database compute awake with a query every minute.
  cron: "*/10 * * * *",
  maxDuration: 300,
  run: async () => {
    const environment = getPublishingEnvironment();
    if (!environment.ENABLE_VIDEO_PUBLISHING)
      return { claimed: 0, dispatched: 0, failed: 0 };

    const claimed = await claimDueReleaseSchedules({
      limit: environment.SOCIAL_SCHEDULER_BATCH_SIZE,
    });

    let dispatched = 0;
    let failed = 0;

    for (const schedule of claimed) {
      /** Records the reason on the schedule so the creator can see it. */
      const fail = async (safeErrorMessage: string) => {
        failed += 1;
        await markReleaseScheduleFailed({
          workspaceId: schedule.workspaceId,
          scheduleId: schedule.id,
          safeErrorMessage,
        });
      };

      try {
        const [project, releasePackage] = await Promise.all([
          findProject({
            workspaceId: schedule.workspaceId,
            projectId: schedule.projectId,
          }),
          findReleasePackage({
            workspaceId: schedule.workspaceId,
            projectId: schedule.projectId,
            releasePackageId: schedule.releasePackageId,
          }),
        ]);

        if (!project) {
          await fail("That project no longer exists.");
          continue;
        }
        if (!releasePackage) {
          await fail("That release package no longer exists.");
          continue;
        }
        // Confirmation is what freezes the wording, so an unconfirmed package
        // has nothing reviewed to publish. Refusing is safer than sending
        // whatever the fields happen to hold now.
        if (!releasePackage.reviewedAt) {
          await fail(
            "This release was not confirmed, so nothing was published.",
          );
          continue;
        }

        const built = buildScheduledPublishInput({
          scheduleId: schedule.id,
          projectId: schedule.projectId,
          renderId: schedule.renderId,
          connectionId: schedule.connectionId,
          metadata: {
            platform: toVideoContentPlatform(releasePackage.platform),
            title: releasePackage.title,
            description: releasePackage.description,
            tags: releasePackage.tags,
            visibility: releasePackage.visibility,
            caption: releasePackage.caption,
            shareToFeed: releasePackage.shareToFeed,
          },
        });
        if (!built.ok) {
          await fail(built.message);
          continue;
        }

        const { publicationId } = await startVideoPublication({
          workspaceId: schedule.workspaceId,
          project,
          request: built.input,
          requestedByUserId: releasePackage.updatedByUserId,
          releasePackageId: releasePackage.id,
          disclosures: {
            madeForKids: releasePackage.madeForKids,
            containsSyntheticMedia: releasePackage.containsSyntheticMedia,
          },
        });

        await markReleaseScheduleDispatched({
          workspaceId: schedule.workspaceId,
          scheduleId: schedule.id,
          publicationId,
        });
        dispatched += 1;
      } catch (error) {
        // A provider's raw error never reaches a creator. The detail goes to
        // the run log, and the schedule records something they can act on.
        console.error("release-scheduler dispatch failed", {
          scheduleId: schedule.id,
          error,
        });
        await fail(
          error instanceof Error &&
            error.name === "VideoPublicationRequestError"
            ? error.message
            : "This release could not be started. Try publishing it manually.",
        );
      }
    }

    return { claimed: claimed.length, dispatched, failed };
  },
});
