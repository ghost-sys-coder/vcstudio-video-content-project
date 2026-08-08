import { redirect } from "next/navigation";
import { MarketingCalendar } from "@/components/marketing/MarketingCalendar";
import { listMarketingCalendarItems } from "@/db/repositories/marketing-content.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { loadSocialPostsView } from "@/lib/social/load-social-posts";
import type { MarketingCalendarEntry } from "@/lib/marketing/calendar/marketing-calendar-grid";
export default async function MarketingCalendarPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "approveMarketingContent"))
    redirect("/app/access-denied");
  const workspaceId = context.activeMembership.workspaceId;
  const [items, posts] = await Promise.all([
    listMarketingCalendarItems({ workspaceId }),
    loadSocialPostsView({ workspaceId }),
  ]);
  const entries: MarketingCalendarEntry[] = [
    ...posts
      .filter((post) =>
        [
          "scheduled",
          "publishing",
          "published",
          "partially_failed",
          "failed",
        ].includes(post.status),
      )
      .map((post) => ({
        kind: "social_post" as const,
        id: post.id,
        title: post.name.trim() || "Untitled post",
        status: post.status,
        occursAt: post.calendarAt,
        mediaPreviewUrl: post.mediaPreviewUrl,
        mediaKind: post.mediaKind,
        platforms: post.targets.map((target) => ({
          label: target.platformLabel,
          accountName: target.accountName,
          status: target.status,
        })),
      })),
    ...items
      .filter(
        ({ item }) => item.socialPostId === null && item.scheduledFor !== null,
      )
      .map(({ item }) => ({
        kind: "marketing_intent" as const,
        id: item.id,
        title: item.title,
        status: "intent" as const,
        occursAt:
          item.scheduledFor?.toISOString() ?? item.createdAt.toISOString(),
        mediaPreviewUrl: null,
        mediaKind: null,
        platforms: [] as [],
      })),
  ];
  return (
    <div className="space-y-3 p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Marketing publishing calendar
      </p>
      <MarketingCalendar
        canCompose={can(context.activeMembership.role, "composePosts")}
        entries={entries}
      />
    </div>
  );
}
