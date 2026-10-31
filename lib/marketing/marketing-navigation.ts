import "server-only";

import type { WorkspaceRole } from "@/db/schema";
import { getMarketingEnvironment } from "@/lib/env/server";
import { isMarketingStudioEnabledForWorkspace } from "@/lib/marketing/marketing-access";
import { can } from "@/lib/policies/workspace-policy";

/** Keep the paused entry discoverable without reading marketing data. */
export async function resolveMarketingNavigation(input: {
  workspaceId: string;
  role: WorkspaceRole;
}) {
  const canViewMarketingStudio = can(input.role, "useMarketingChat");
  const marketingDeploymentEnabled =
    getMarketingEnvironment().ENABLE_MARKETING_STUDIO;
  const marketingStudioEnabled =
    canViewMarketingStudio && marketingDeploymentEnabled
      ? await isMarketingStudioEnabledForWorkspace({
          workspaceId: input.workspaceId,
        })
      : false;

  return {
    canViewMarketingStudio,
    marketingDeploymentEnabled,
    marketingStudioEnabled,
  };
}
