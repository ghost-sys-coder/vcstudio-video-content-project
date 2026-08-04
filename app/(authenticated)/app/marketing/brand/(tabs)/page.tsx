import Link from "next/link";
import { BrandProfileForm } from "@/components/marketing/BrandProfileForm";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadBrandWorkspaceView } from "@/lib/marketing/brand/brand-view";

export default async function BrandProfilePage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const view = await loadBrandWorkspaceView({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <div className="space-y-4 pt-4">
      {view.profile.onboardingStatus !== "complete" ? (
        <p className="rounded-lg border border-notice-info-edge bg-notice-info px-2.5 py-2 text-sm text-notice-info-foreground">
          The interview is not finished — {view.completeness.requiredRemaining}{" "}
          required question
          {view.completeness.requiredRemaining === 1 ? "" : "s"} left.{" "}
          <Link
            className="underline underline-offset-4"
            href="/app/marketing/brand/onboarding"
          >
            Continue it
          </Link>
          .
        </p>
      ) : null}

      <BrandProfileForm profile={view.profile} />
    </div>
  );
}
