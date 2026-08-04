import { redirect } from "next/navigation";
import { BrandHeader } from "@/components/marketing/BrandHeader";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { findBrandProfile } from "@/db/repositories/marketing-brand.repository";
import { can } from "@/lib/policies/workspace-policy";

/**
 * Tab shell for the brand pages.
 *
 * A route group so the onboarding wizard, which is a sibling route, does not
 * inherit the tab bar — it is a full-bleed page by design.
 */
export default async function BrandTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  if (!can(context.activeMembership.role, "manageBrandProfile"))
    redirect("/app/access-denied");

  const profile = await findBrandProfile({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <BrandHeader onboardingComplete={profile?.onboardingStatus === "complete"}>
      {children}
    </BrandHeader>
  );
}
