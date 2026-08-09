import { redirect } from "next/navigation";
import { ActivityCenter } from "@/components/activity/ActivityCenter";
import { listWorkspaceActivity } from "@/db/repositories/activity.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { activityFilterSchema } from "@/lib/schemas/activity";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  const raw = await searchParams;
  const parsed = activityFilterSchema.parse({
    category: Array.isArray(raw.category) ? raw.category[0] : raw.category,
    state: Array.isArray(raw.state) ? raw.state[0] : raw.state,
    page: Array.isArray(raw.page) ? raw.page[0] : raw.page,
  });
  const view = await listWorkspaceActivity({
    workspaceId: context.activeMembership.workspaceId,
    userId: context.user.id,
    ...parsed,
  });
  return (
    <ActivityCenter
      workspaceId={context.activeMembership.workspaceId}
      filters={parsed}
      view={view}
    />
  );
}
