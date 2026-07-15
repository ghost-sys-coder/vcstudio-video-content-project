import { redirect } from "next/navigation";
import { ApplicationShell } from "@/components/application/ApplicationShell";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthenticatedWorkspaceContext();

  if (!context) {
    redirect("/onboarding");
  }

  return (
    <ApplicationShell
      activeMembership={context.activeMembership}
      memberships={context.memberships}
      user={context.user}
    >
      {children}
    </ApplicationShell>
  );
}
