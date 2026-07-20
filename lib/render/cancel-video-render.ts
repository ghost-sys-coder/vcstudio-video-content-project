import "server-only";

import { runs } from "@trigger.dev/sdk";
import { cancelVideoRender } from "@/db/commands/video-render-commands";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";

const NON_TERMINAL_STATUSES = new Set(["pending", "queued", "running"]);

/**
 * Cancels a render end to end: stops the live Trigger.dev run so the worker
 * machine actually halts, then settles application state and releases the
 * reserved budget through the money-safe ledger command.
 *
 * A render can stall while `running` — most commonly when its short-lived
 * signed asset URLs expire mid-render and headless Chromium starts receiving
 * HTTP 403 from R2, which Remotion cannot decode into frames — so a user must
 * be able to reclaim the machine and the reserved budget without waiting for
 * the reservation to expire.
 *
 * The Trigger run is cancelled first (best effort) so compute stops as soon as
 * possible; cancelling an already-finished or unknown run is a harmless no-op,
 * and a failure there never blocks the authoritative ledger settlement that
 * follows. The DB command is the source of truth for whether the cancel took.
 */
export async function cancelVideoRenderRun(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  actorUserId: string;
}): Promise<{ cancelled: boolean }> {
  const render = await findVideoRender({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    renderId: input.renderId,
  });
  if (!render) return { cancelled: false };

  if (render.triggerRunId && NON_TERMINAL_STATUSES.has(render.status)) {
    try {
      await runs.cancel(render.triggerRunId);
    } catch (error) {
      // A failed run-cancel must not prevent budget release: the ledger command
      // below still settles state, and the worker is blocked from recording a
      // success by its own status guards. Log for support and continue.
      console.error("Failed to cancel Trigger run for video render.", {
        renderId: input.renderId,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }
  }

  const result = await cancelVideoRender({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    renderId: input.renderId,
  });

  if (result.cancelled)
    await recordAuditEvent({
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      projectId: input.projectId,
      action: "generation_cancelled",
      targetType: "video_render",
      targetId: input.renderId,
      metadata: { wasRunning: result.wasRunning },
    });

  return { cancelled: result.cancelled };
}
