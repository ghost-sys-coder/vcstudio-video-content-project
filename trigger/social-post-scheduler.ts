import { schedules, tasks } from "@trigger.dev/sdk";
import { claimDueSocialPosts } from "@/db/commands/social-post-schedule-commands";
import {
  markSocialPostTargetFailed,
  markSocialPostTargetQueued,
  reconcileSocialPostStatus,
} from "@/db/commands/social-post-target-commands";
import { listSocialPostTargets } from "@/db/repositories/social-posts.repository";
import { getPublishingEnvironment } from "@/lib/env/server";
import type { socialPostPublishTask } from "@/trigger/social-post-publish";

/**
 * Sweeps for scheduled posts that have come due and dispatches them.
 *
 * **Why a sweeper rather than Trigger's `delay`.** `AGENTS.md` requires
 * PostgreSQL to be authoritative and forbids background workflow state from
 * being the only source of truth. With the schedule in the database:
 * rescheduling and cancelling are plain `UPDATE`s with nothing to revoke; a
 * dropped, expired, or cancelled delayed run cannot orphan a post; and a post
 * scheduled while the worker was down still goes out once it comes back. The
 * cost is up to about a minute of jitter, which is the right trade for content
 * scheduling.
 *
 * Claiming is atomic (see `claimDueSocialPosts`), so running two workers, or a
 * sweep overlapping a slow previous one, cannot double-publish.
 */
export const socialPostSchedulerTask = schedules.task({
  id: "social-post-scheduler",
  cron: "* * * * *",
  maxDuration: 120,
  run: async () => {
    const environment = getPublishingEnvironment();
    if (!environment.ENABLE_SOCIAL_POSTING)
      return { claimed: 0, dispatched: 0 };

    const claimed = await claimDueSocialPosts({
      limit: environment.SOCIAL_SCHEDULER_BATCH_SIZE,
    });

    let dispatched = 0;
    for (const post of claimed) {
      const targets = await listSocialPostTargets({
        workspaceId: post.workspaceId,
        postId: post.id,
      });
      const pending = targets.filter(
        (target) => target.status === "pending" || target.status === "failed",
      );

      // A scheduled post with nothing left to send has already settled; let the
      // projection put it back into a truthful state rather than leaving it
      // stuck at `publishing`.
      if (pending.length === 0) {
        await reconcileSocialPostStatus({
          workspaceId: post.workspaceId,
          postId: post.id,
        });
        continue;
      }

      for (const target of pending) {
        try {
          const handle = await tasks.trigger<typeof socialPostPublishTask>(
            "social-post-publish",
            {
              targetId: target.id,
              postId: post.id,
              workspaceId: post.workspaceId,
            },
            { idempotencyKey: target.idempotencyKey },
          );
          await markSocialPostTargetQueued({
            targetId: target.id,
            triggerRunId: handle.id,
          });
          dispatched += 1;
        } catch {
          // One destination failing to queue must not abandon the others, and
          // must not leave the post spinning: mark it and let the projection
          // settle the post once every target has an outcome.
          await markSocialPostTargetFailed({
            targetId: target.id,
            category: "dispatch_failed",
            message: "This destination could not be queued.",
          });
          await reconcileSocialPostStatus({
            workspaceId: post.workspaceId,
            postId: post.id,
          });
        }
      }
    }

    return { claimed: claimed.length, dispatched };
  },
});
