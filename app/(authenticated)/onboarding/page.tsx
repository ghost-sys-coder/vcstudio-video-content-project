import { redirect } from "next/navigation";
import { listWorkspaceMemberships } from "@/db/repositories/workspaces.repository";
import { WorkspaceOnboarding } from "@/components/onboarding/WorkspaceOnboarding";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";

export default async function OnboardingPage() {
  const user = await requireAuthenticatedUser();
  const memberships = await listWorkspaceMemberships(user.id);

  if (memberships.length > 0) {
    redirect("/app");
  }

  return <WorkspaceOnboarding displayName={user.displayName} />;
}
