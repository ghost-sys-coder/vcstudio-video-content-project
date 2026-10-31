import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const deployment = vi.hoisted(() => ({ enabled: false }));
const loadWorkspaceEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env/server", () => ({
  getMarketingEnvironment: () => ({
    ENABLE_MARKETING_STUDIO: deployment.enabled,
  }),
}));
vi.mock("@/lib/marketing/marketing-access", () => ({
  isMarketingStudioEnabledForWorkspace: loadWorkspaceEnabled,
}));

import { resolveMarketingNavigation } from "./marketing-navigation";

const workspaceId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  deployment.enabled = false;
  loadWorkspaceEnabled.mockReset();
  loadWorkspaceEnabled.mockResolvedValue(true);
});

describe("Marketing Studio navigation", () => {
  it.each(["owner", "editor"] as const)(
    "keeps a locked entry visible to %s while paused without a database read",
    async (role) => {
      await expect(
        resolveMarketingNavigation({ workspaceId, role }),
      ).resolves.toEqual({
        canViewMarketingStudio: true,
        marketingDeploymentEnabled: false,
        marketingStudioEnabled: false,
      });
      expect(loadWorkspaceEnabled).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "keeps the entry unavailable to viewers when deployment enabled is %s",
    async (enabled) => {
      deployment.enabled = enabled;
      await expect(
        resolveMarketingNavigation({ workspaceId, role: "viewer" }),
      ).resolves.toEqual({
        canViewMarketingStudio: false,
        marketingDeploymentEnabled: enabled,
        marketingStudioEnabled: false,
      });
      expect(loadWorkspaceEnabled).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "honors workspace enabled state %s only when the deployment is enabled",
    async (enabled) => {
      deployment.enabled = true;
      loadWorkspaceEnabled.mockResolvedValue(enabled);
      await expect(
        resolveMarketingNavigation({ workspaceId, role: "owner" }),
      ).resolves.toEqual({
        canViewMarketingStudio: true,
        marketingDeploymentEnabled: true,
        marketingStudioEnabled: enabled,
      });
      expect(loadWorkspaceEnabled).toHaveBeenCalledExactlyOnceWith({
        workspaceId,
      });
    },
  );
});
