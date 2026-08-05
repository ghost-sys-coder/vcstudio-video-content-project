import "server-only";
import { findMarketingScheduleRule } from "@/db/repositories/marketing-schedules.repository";
import { findActivePlatformConnection } from "@/db/repositories/publishing.repository";
import type { MarketingContentItem } from "@/db/schema";
import { loadMarketingSettings } from "@/lib/marketing/marketing-settings-view";
import { createPostFromContentItem } from "@/lib/marketing/publish/create-post-from-content-item";
import { scheduleSocialPostPublication } from "@/lib/social/schedule-social-post";
import { checkScheduleInstant } from "@/lib/social/schedule-window";

export type ApprovedContentScheduleResult =
  | { attempted: false }
  | { attempted: true; scheduled: true; postId: string }
  | { attempted: true; scheduled: false; reason: string };

export async function autoScheduleApprovedContent(input: {
  workspaceId: string;
  item: MarketingContentItem;
  approvedByUserId: string;
  now?: Date;
}): Promise<ApprovedContentScheduleResult> {
  const scheduleRuleId = input.item.structuredPayload?.scheduleRuleId;
  if (
    typeof scheduleRuleId !== "string" ||
    !input.item.scheduledFor ||
    !input.item.platform
  )
    return { attempted: false };

  const [rule, settings] = await Promise.all([
    findMarketingScheduleRule({
      workspaceId: input.workspaceId,
      ruleId: scheduleRuleId,
    }),
    loadMarketingSettings({ workspaceId: input.workspaceId }),
  ]);
  if (!rule || !rule.autoSchedule) return { attempted: false };
  if (!rule.isEnabled)
    return {
      attempted: true,
      scheduled: false,
      reason:
        "The draft was approved, but its recurring rule is paused. Resume the rule or schedule the Social draft manually.",
    };
  if (settings.autonomyLevel === "manual")
    return {
      attempted: true,
      scheduled: false,
      reason:
        "The draft was approved, but automatic scheduling is stopped while autonomy is Manual.",
    };
  const instant = checkScheduleInstant({
    scheduledAt: input.item.scheduledFor,
    now: input.now,
  });
  if (!instant.valid)
    return {
      attempted: true,
      scheduled: false,
      reason: `The draft was approved, but its proposed time could not be used: ${instant.reason}`,
    };
  const connection = await findActivePlatformConnection({
    workspaceId: input.workspaceId,
    platform: input.item.platform,
  });
  if (!connection)
    return {
      attempted: true,
      scheduled: false,
      reason: `The draft was approved, but no active ${input.item.platform} account is available. Open it as a Social draft to choose a destination.`,
    };
  try {
    const { postId } = await createPostFromContentItem({
      workspaceId: input.workspaceId,
      contentItemId: input.item.id,
      createdByUserId: input.approvedByUserId,
    });
    await scheduleSocialPostPublication({
      workspaceId: input.workspaceId,
      postId,
      scheduledAt: instant.scheduledAt,
      timezone: rule.timezone,
      connectionIds: [connection.id],
      requestNonce: input.item.id,
      now: input.now,
    });
    return { attempted: true, scheduled: true, postId };
  } catch {
    return {
      attempted: true,
      scheduled: false,
      reason:
        "The draft was approved, but Social could not schedule it automatically. Open the Social draft to finish scheduling.",
    };
  }
}
