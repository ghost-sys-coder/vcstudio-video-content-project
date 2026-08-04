import { redirect } from "next/navigation";
import { AssetsHeader } from "@/components/marketing/AssetsHeader";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";

export default async function MarketingAssetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  if (!can(context.activeMembership.role, "manageBrandProfile"))
    redirect("/app/access-denied");

  return <AssetsHeader>{children}</AssetsHeader>;
}
