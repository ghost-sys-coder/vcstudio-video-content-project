import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandOnboardingWizard } from "@/components/marketing/BrandOnboardingWizard";
import { Button } from "@/components/ui/button";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadBrandWorkspaceView } from "@/lib/marketing/brand/brand-view";
import { can } from "@/lib/policies/workspace-policy";

export default async function BrandOnboardingPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  if (!can(context.activeMembership.role, "manageBrandProfile"))
    redirect("/app/access-denied");

  const view = await loadBrandWorkspaceView({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <Button
          className="px-0"
          nativeButton={false}
          render={<Link href="/app/marketing" />}
          size="sm"
          variant="link"
        >
          ← Marketing Studio
        </Button>
        <h1 className="text-xl font-semibold">Tell the studio about you</h1>
        <p className="text-sm text-muted-foreground">
          Everything it writes is grounded in these answers. Plain language
          beats polished language — write it the way you would say it out loud,
          and skip anything that is not true.
        </p>
      </header>

      <BrandOnboardingWizard
        initialAnswers={view.answers}
        isComplete={view.profile.onboardingStatus === "complete"}
      />
    </div>
  );
}
