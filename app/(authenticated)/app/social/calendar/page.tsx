import { redirect } from "next/navigation";
import { ScheduleCalendar } from "@/components/social/ScheduleCalendar";
import { SocialPageFrame } from "@/components/social/SocialPageFrame";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadSocialPostsView } from "@/lib/social/load-social-posts";
import { can } from "@/lib/policies/workspace-policy";

export default async function SocialCalendarPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "composePosts"))
    redirect("/app/access-denied");

  const posts = await loadSocialPostsView({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <SocialPageFrame>
      <div className="space-y-6">
        <header className="px-0.5">
          <h1 className="text-xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            What is queued and what has gone out, grouped by day in your own
            timezone.
          </p>
        </header>
        <ScheduleCalendar posts={posts} />
      </div>
    </SocialPageFrame>
  );
}
