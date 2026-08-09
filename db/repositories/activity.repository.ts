import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  activityAcknowledgements,
  googleBusinessConnections,
  marketingContentItems,
  marketingScheduleRuleRuns,
  marketingScheduleRules,
  projects,
  sceneAudioGenerations,
  sceneImageGenerations,
  socialPosts,
  socialPostTargets,
  videoRenders,
} from "@/db/schema";
import type { ActivityCategory } from "@/lib/schemas/activity";
import {
  createFailurePresentation,
  type FailurePresentation,
} from "@/lib/failures/failure-recovery";

const SOURCE_LIMIT = 100;
export const ACTIVITY_PAGE_SIZE = 20;

export type ActivitySeverity = "info" | "warning" | "critical";
export type ActivityItem = {
  key: string;
  category: ActivityCategory;
  severity: ActivitySeverity;
  title: string;
  detail: string;
  href: string;
  occurredAt: Date;
  acknowledged: boolean;
  recovery: FailurePresentation | null;
};

type ActivityCandidate = Omit<ActivityItem, "acknowledged">;

function projectHref(
  projectId: string,
  area: "audio" | "render" | "storyboard",
) {
  return `/app/projects/${projectId}/${area}`;
}

function failureCategory(errorCategory: string | null): ActivityCategory {
  return errorCategory && /budget|cap|quota|limit/i.test(errorCategory)
    ? "budget_or_cap_refusal"
    : "failed";
}

export async function listWorkspaceActivity(input: {
  workspaceId: string;
  userId: string;
  category?: ActivityCategory;
  state: "all" | "unread" | "acknowledged";
  page: number;
}): Promise<{ items: ActivityItem[]; hasNextPage: boolean }> {
  const database = getDatabase();
  const workspace = eq(projects.workspaceId, input.workspaceId);
  const [images, audio, renders, targets, content, scheduleRuns, connections] =
    await Promise.all([
      database
        .select({
          id: sceneImageGenerations.id,
          projectId: sceneImageGenerations.projectId,
          status: sceneImageGenerations.status,
          reviewStatus: sceneImageGenerations.reviewStatus,
          error: sceneImageGenerations.safeErrorMessage,
          errorCategory: sceneImageGenerations.errorCategory,
          updatedAt: sceneImageGenerations.updatedAt,
          projectName: projects.name,
        })
        .from(sceneImageGenerations)
        .innerJoin(
          projects,
          and(eq(projects.id, sceneImageGenerations.projectId), workspace),
        )
        .where(
          and(
            eq(sceneImageGenerations.workspaceId, input.workspaceId),
            inArray(sceneImageGenerations.status, ["succeeded", "failed"]),
          ),
        )
        .orderBy(desc(sceneImageGenerations.updatedAt))
        .limit(SOURCE_LIMIT),
      database
        .select({
          id: sceneAudioGenerations.id,
          projectId: sceneAudioGenerations.projectId,
          status: sceneAudioGenerations.status,
          reviewStatus: sceneAudioGenerations.reviewStatus,
          error: sceneAudioGenerations.safeErrorMessage,
          errorCategory: sceneAudioGenerations.errorCategory,
          updatedAt: sceneAudioGenerations.updatedAt,
          projectName: projects.name,
        })
        .from(sceneAudioGenerations)
        .innerJoin(
          projects,
          and(eq(projects.id, sceneAudioGenerations.projectId), workspace),
        )
        .where(
          and(
            eq(sceneAudioGenerations.workspaceId, input.workspaceId),
            inArray(sceneAudioGenerations.status, ["succeeded", "failed"]),
          ),
        )
        .orderBy(desc(sceneAudioGenerations.updatedAt))
        .limit(SOURCE_LIMIT),
      database
        .select({
          id: videoRenders.id,
          projectId: videoRenders.projectId,
          status: videoRenders.status,
          error: videoRenders.safeErrorMessage,
          errorCategory: videoRenders.errorCategory,
          updatedAt: videoRenders.updatedAt,
          projectName: projects.name,
        })
        .from(videoRenders)
        .innerJoin(
          projects,
          and(eq(projects.id, videoRenders.projectId), workspace),
        )
        .where(
          and(
            eq(videoRenders.workspaceId, input.workspaceId),
            inArray(videoRenders.status, ["succeeded", "failed"]),
          ),
        )
        .orderBy(desc(videoRenders.updatedAt))
        .limit(SOURCE_LIMIT),
      database
        .select({
          id: socialPostTargets.id,
          postId: socialPostTargets.postId,
          platform: socialPostTargets.platform,
          status: socialPostTargets.status,
          postStatus: socialPosts.status,
          postName: socialPosts.name,
          error: socialPostTargets.safeErrorMessage,
          errorCategory: socialPostTargets.errorCategory,
          updatedAt: socialPostTargets.updatedAt,
        })
        .from(socialPostTargets)
        .innerJoin(
          socialPosts,
          and(
            eq(socialPosts.id, socialPostTargets.postId),
            eq(socialPosts.workspaceId, input.workspaceId),
          ),
        )
        .where(
          and(
            eq(socialPostTargets.workspaceId, input.workspaceId),
            inArray(socialPostTargets.status, ["published", "failed"]),
          ),
        )
        .orderBy(desc(socialPostTargets.updatedAt))
        .limit(SOURCE_LIMIT),
      database
        .select({
          id: marketingContentItems.id,
          title: marketingContentItems.title,
          status: marketingContentItems.status,
          error: marketingContentItems.safeErrorMessage,
          errorCategory: marketingContentItems.errorCategory,
          updatedAt: marketingContentItems.updatedAt,
        })
        .from(marketingContentItems)
        .where(
          and(
            eq(marketingContentItems.workspaceId, input.workspaceId),
            inArray(marketingContentItems.status, [
              "needs_review",
              "approved",
              "published",
              "failed",
            ]),
          ),
        )
        .orderBy(desc(marketingContentItems.updatedAt))
        .limit(SOURCE_LIMIT),
      database
        .select({
          id: marketingScheduleRuleRuns.id,
          status: marketingScheduleRuleRuns.status,
          skipReason: marketingScheduleRuleRuns.skipReason,
          error: marketingScheduleRuleRuns.safeErrorMessage,
          errorCategory: marketingScheduleRuleRuns.errorCategory,
          updatedAt: marketingScheduleRuleRuns.updatedAt,
          ruleName: marketingScheduleRules.name,
          ruleId: marketingScheduleRules.id,
        })
        .from(marketingScheduleRuleRuns)
        .innerJoin(
          marketingScheduleRules,
          and(
            eq(marketingScheduleRules.id, marketingScheduleRuleRuns.ruleId),
            eq(marketingScheduleRules.workspaceId, input.workspaceId),
          ),
        )
        .where(
          and(
            eq(marketingScheduleRuleRuns.workspaceId, input.workspaceId),
            inArray(marketingScheduleRuleRuns.status, ["skipped", "failed"]),
          ),
        )
        .orderBy(desc(marketingScheduleRuleRuns.updatedAt))
        .limit(SOURCE_LIMIT),
      database
        .select({
          id: googleBusinessConnections.id,
          status: googleBusinessConnections.status,
          syncStatus: googleBusinessConnections.syncStatus,
          error: googleBusinessConnections.lastError,
          updatedAt: googleBusinessConnections.updatedAt,
        })
        .from(googleBusinessConnections)
        .where(eq(googleBusinessConnections.workspaceId, input.workspaceId))
        .limit(1),
    ]);

  const candidates: ActivityCandidate[] = [];
  for (const row of images)
    candidates.push({
      key: `scene-image:${row.id}`,
      category:
        row.status === "failed"
          ? failureCategory(row.errorCategory)
          : row.reviewStatus === "pending"
            ? "review_required"
            : "completed",
      severity: row.status === "failed" ? "critical" : "warning",
      title:
        row.status === "failed"
          ? `Image generation failed — ${row.projectName}`
          : `Scene image ready for review — ${row.projectName}`,
      detail: row.error ?? "Review the generated scene image.",
      href: `${projectHref(row.projectId, "storyboard")}?generation=${row.id}`,
      occurredAt: row.updatedAt,
      recovery:
        row.status === "failed"
          ? createFailurePresentation({
              errorCategory: row.errorCategory,
              source: "scene_image",
              sourceHref: `${projectHref(row.projectId, "storyboard")}?generation=${row.id}`,
              correlationId: `scene-image:${row.id}`,
            })
          : null,
    });
  for (const row of audio)
    candidates.push({
      key: `scene-audio:${row.id}`,
      category:
        row.status === "failed"
          ? failureCategory(row.errorCategory)
          : row.reviewStatus === "pending"
            ? "review_required"
            : "completed",
      severity: row.status === "failed" ? "critical" : "warning",
      title:
        row.status === "failed"
          ? `Audio generation failed — ${row.projectName}`
          : `Narration ready for review — ${row.projectName}`,
      detail: row.error ?? "Review the generated narration.",
      href: `${projectHref(row.projectId, "audio")}?generation=${row.id}`,
      occurredAt: row.updatedAt,
      recovery:
        row.status === "failed"
          ? createFailurePresentation({
              errorCategory: row.errorCategory,
              source: "scene_audio",
              sourceHref: `${projectHref(row.projectId, "audio")}?generation=${row.id}`,
              correlationId: `scene-audio:${row.id}`,
            })
          : null,
    });
  for (const row of renders)
    candidates.push({
      key: `render:${row.id}`,
      category:
        row.status === "failed"
          ? failureCategory(row.errorCategory)
          : "completed",
      severity: row.status === "failed" ? "critical" : "info",
      title:
        row.status === "failed"
          ? `Render failed — ${row.projectName}`
          : `Render completed — ${row.projectName}`,
      detail: row.error ?? "The export is ready.",
      href: `${projectHref(row.projectId, "render")}?render=${row.id}`,
      occurredAt: row.updatedAt,
      recovery:
        row.status === "failed"
          ? createFailurePresentation({
              errorCategory: row.errorCategory,
              source: "render",
              sourceHref: `${projectHref(row.projectId, "render")}?render=${row.id}`,
              correlationId: `render:${row.id}`,
            })
          : null,
    });
  for (const row of targets) {
    const partial =
      row.status === "failed" && row.postStatus === "partially_failed";
    candidates.push({
      key: `social-target:${row.id}`,
      category: partial
        ? "partially_failed"
        : row.status === "failed"
          ? "failed"
          : "completed",
      severity: row.status === "failed" ? "critical" : "info",
      title: `${row.platform} ${row.status === "failed" ? "failed" : "published"} — ${row.postName || "Social post"}`,
      detail:
        row.error ?? `${row.platform} destination completed successfully.`,
      href: `/app/social/posts/${row.postId}?target=${row.id}`,
      occurredAt: row.updatedAt,
      recovery:
        row.status === "failed"
          ? createFailurePresentation({
              errorCategory: row.errorCategory,
              source: "social_destination",
              sourceHref: `/app/social/posts/${row.postId}?target=${row.id}`,
              correlationId: `social-target:${row.id}`,
            })
          : null,
    });
  }
  for (const row of content)
    candidates.push({
      key: `marketing-content:${row.id}`,
      category:
        row.status === "needs_review"
          ? "review_required"
          : row.status === "failed"
            ? failureCategory(row.errorCategory)
            : "completed",
      severity:
        row.status === "failed"
          ? "critical"
          : row.status === "needs_review"
            ? "warning"
            : "info",
      title: `${row.title || "Marketing content"} — ${row.status.replaceAll("_", " ")}`,
      detail: row.error ?? "Open the exact content item for details.",
      href: `/app/marketing/content/${row.id}`,
      occurredAt: row.updatedAt,
      recovery:
        row.status === "failed"
          ? createFailurePresentation({
              errorCategory: row.errorCategory,
              source: "marketing_content",
              sourceHref: `/app/marketing/content/${row.id}`,
              correlationId: `marketing-content:${row.id}`,
            })
          : null,
    });
  for (const row of scheduleRuns)
    candidates.push({
      key: `marketing-schedule:${row.id}`,
      category:
        row.status === "skipped" ? "scheduled_action_skipped" : "failed",
      severity: row.status === "failed" ? "critical" : "warning",
      title: `${row.ruleName} — ${row.status}`,
      detail:
        row.skipReason ?? row.error ?? "Open the schedule rule for details.",
      href: `/app/marketing/schedules?edit=${row.ruleId}&run=${row.id}`,
      occurredAt: row.updatedAt,
      recovery: createFailurePresentation({
        errorCategory:
          row.status === "skipped"
            ? (row.skipReason ?? "validation")
            : row.errorCategory,
        source: "marketing_schedule",
        sourceHref: `/app/marketing/schedules?edit=${row.ruleId}&run=${row.id}`,
        correlationId: `marketing-schedule:${row.id}`,
      }),
    });
  for (const row of connections)
    if (row.status !== "active" || row.syncStatus === "failed")
      candidates.push({
        key: `google-business:${row.id}`,
        category: "integration_attention",
        severity: "critical",
        title: "Google Business Profile needs attention",
        detail: row.error ?? "Reconnect or synchronize the business profile.",
        href: "/app/marketing/integrations",
        occurredAt: row.updatedAt,
        recovery: createFailurePresentation({
          errorCategory:
            row.status !== "active" ? "authorization" : "configuration",
          source: "google_business",
          sourceHref: "/app/marketing/integrations",
          correlationId: `google-business:${row.id}`,
        }),
      });

  const keys = candidates.map((item) => item.key);
  const acknowledgements =
    keys.length === 0
      ? []
      : await database
          .select({ key: activityAcknowledgements.activityKey })
          .from(activityAcknowledgements)
          .where(
            and(
              eq(activityAcknowledgements.workspaceId, input.workspaceId),
              eq(activityAcknowledgements.userId, input.userId),
              inArray(activityAcknowledgements.activityKey, keys),
            ),
          );
  const acknowledged = new Set(acknowledgements.map((row) => row.key));
  const filtered = candidates
    .map((item) => ({ ...item, acknowledged: acknowledged.has(item.key) }))
    .filter(
      (item) =>
        (!input.category || item.category === input.category) &&
        (input.state === "all" ||
          (input.state === "acknowledged"
            ? item.acknowledged
            : !item.acknowledged)),
    )
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  const offset = (input.page - 1) * ACTIVITY_PAGE_SIZE;
  return {
    items: filtered.slice(offset, offset + ACTIVITY_PAGE_SIZE),
    hasNextPage: filtered.length > offset + ACTIVITY_PAGE_SIZE,
  };
}

export async function acknowledgeWorkspaceActivity(input: {
  workspaceId: string;
  userId: string;
  activityKey: string;
}): Promise<boolean> {
  const [kind, id] = input.activityKey.split(":") as [string, string];
  const database = getDatabase();
  const tableByKind = {
    "scene-image": sceneImageGenerations,
    "scene-audio": sceneAudioGenerations,
    render: videoRenders,
    "social-target": socialPostTargets,
    "marketing-content": marketingContentItems,
    "marketing-schedule": marketingScheduleRuleRuns,
    "google-business": googleBusinessConnections,
  } as const;
  const table = tableByKind[kind as keyof typeof tableByKind];
  if (!table) return false;
  const exists = await database
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.workspaceId, input.workspaceId)))
    .limit(1);
  if (!exists[0]) return false;
  await database
    .insert(activityAcknowledgements)
    .values(input)
    .onConflictDoUpdate({
      target: [
        activityAcknowledgements.workspaceId,
        activityAcknowledgements.userId,
        activityAcknowledgements.activityKey,
      ],
      set: { acknowledgedAt: new Date() },
    });
  return true;
}
