import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const deployment = vi.hoisted(() => ({ enabled: true }));
const stored = vi.hoisted(() => ({
  row: null as { studioEnabled: boolean } | null,
}));

vi.mock("@/lib/env/server", () => ({
  getMarketingEnvironment: () => ({
    ENABLE_MARKETING_STUDIO: deployment.enabled,
  }),
}));
vi.mock("@/db/repositories/marketing-settings.repository", () => ({
  findMarketingSettings: async () => stored.row,
}));

import {
  isMarketingStudioEnabledForWorkspace,
  resolveMarketingAccess,
} from "@/lib/marketing/marketing-access";

const workspaceId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  deployment.enabled = true;
  stored.row = null;
});

describe("resolveMarketingAccess", () => {
  it("is available when the deployment ships it and the workspace opted in", async () => {
    stored.row = { studioEnabled: true };
    await expect(resolveMarketingAccess({ workspaceId })).resolves.toEqual({
      available: true,
    });
  });

  it("is off by default for a workspace that has never saved settings", async () => {
    // No row means never opted in. Enabling the feature for a deployment must
    // not silently hand every existing workspace something that can spend.
    stored.row = null;
    await expect(resolveMarketingAccess({ workspaceId })).resolves.toEqual({
      available: false,
      reason: "workspace_disabled",
    });
  });

  it("reports workspace_disabled when the workspace switched it off", async () => {
    stored.row = { studioEnabled: false };
    await expect(resolveMarketingAccess({ workspaceId })).resolves.toEqual({
      available: false,
      reason: "workspace_disabled",
    });
  });

  it("reports deployment_disabled when the environment flag is off", async () => {
    deployment.enabled = false;
    stored.row = { studioEnabled: true };
    await expect(resolveMarketingAccess({ workspaceId })).resolves.toEqual({
      available: false,
      reason: "deployment_disabled",
    });
  });

  it("lets the deployment flag override an opted-in workspace", async () => {
    // The workspace cannot opt into a feature the deployment has not shipped:
    // the worker that would run its paid work reads the same flag, so honouring
    // the workspace preference here would queue work nothing can execute.
    deployment.enabled = false;
    stored.row = { studioEnabled: true };
    const access = await resolveMarketingAccess({ workspaceId });
    expect(access.available).toBe(false);
  });

  it("distinguishes the two refusals rather than collapsing them to a boolean", async () => {
    // The segment answers 404 for one and an explanation for the other; a
    // single boolean could not tell them apart.
    deployment.enabled = false;
    const deploymentOff = await resolveMarketingAccess({ workspaceId });
    deployment.enabled = true;
    const workspaceOff = await resolveMarketingAccess({ workspaceId });
    expect(deploymentOff).not.toEqual(workspaceOff);
  });
});

describe("isMarketingStudioEnabledForWorkspace", () => {
  it("reads the stored switch", async () => {
    stored.row = { studioEnabled: true };
    await expect(
      isMarketingStudioEnabledForWorkspace({ workspaceId }),
    ).resolves.toBe(true);
  });

  it("defaults to false with no row", async () => {
    stored.row = null;
    await expect(
      isMarketingStudioEnabledForWorkspace({ workspaceId }),
    ).resolves.toBe(false);
  });

  it("ignores the deployment flag, so the toggle shows its own state", async () => {
    // The settings toggle renders the workspace's stored preference and
    // separately explains that the deployment has it off; conflating the two
    // would make the switch appear to have moved on its own.
    deployment.enabled = false;
    stored.row = { studioEnabled: true };
    await expect(
      isMarketingStudioEnabledForWorkspace({ workspaceId }),
    ).resolves.toBe(true);
  });
});
