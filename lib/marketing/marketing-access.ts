import "server-only";

import { findMarketingSettings } from "@/db/repositories/marketing-settings.repository";
import { getMarketingEnvironment } from "@/lib/env/server";

/**
 * Why a workspace cannot use the Marketing Studio right now.
 *
 * `deployment_disabled` and `workspace_disabled` are deliberately different
 * outcomes rather than one boolean. The first means the feature does not exist
 * in this deployment and no amount of clicking will change that — the segment
 * answers `notFound()`, because an unreleased feature should be
 * indistinguishable from one that was never built. The second means the feature
 * exists and this workspace has simply not switched it on, which is a thing a
 * user can act on, so it earns an explanation instead of a dead end.
 */
export type MarketingAccess =
  | { available: true }
  | { available: false; reason: "deployment_disabled" }
  | { available: false; reason: "workspace_disabled" };

/**
 * Resolves whether the Marketing Studio is usable for a workspace.
 *
 * Two independent switches, checked in order of authority. The deployment flag
 * wins: a workspace cannot opt into a feature the deployment has not shipped,
 * and the worker that would execute its paid work reads the same flag.
 */
export async function resolveMarketingAccess(input: {
  workspaceId: string;
}): Promise<MarketingAccess> {
  if (!getMarketingEnvironment().ENABLE_MARKETING_STUDIO)
    return { available: false, reason: "deployment_disabled" };

  const settings = await findMarketingSettings({
    workspaceId: input.workspaceId,
  });
  // No row means the workspace has never opted in. Off by default, so enabling
  // the feature for a deployment never silently hands an existing workspace
  // something that can spend money.
  if (!settings?.studioEnabled)
    return { available: false, reason: "workspace_disabled" };

  return { available: true };
}

/** Reads just the workspace switch, for rendering the settings toggle. */
export async function isMarketingStudioEnabledForWorkspace(input: {
  workspaceId: string;
}): Promise<boolean> {
  const settings = await findMarketingSettings({
    workspaceId: input.workspaceId,
  });
  return settings?.studioEnabled ?? false;
}
