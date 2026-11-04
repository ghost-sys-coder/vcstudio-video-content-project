import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  usageView,
  operationsWorkspaceId,
} from "@/e2e/mcp/fixtures/operations-data";

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  settings: vi.fn(),
  ledger: vi.fn(),
  audit: vi.fn(),
  marketing: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/repositories/usage-summary.repository", () => ({
  getWorkspaceUsageSummary: mocks.summary,
}));
vi.mock("@/db/repositories/budget-settings.repository", () => ({
  getWorkspaceBudgetSettings: mocks.settings,
}));
vi.mock("@/db/repositories/usage-ledger.repository", () => ({
  listUsageLedgerEntries: mocks.ledger,
}));
vi.mock("@/db/repositories/audit-log.repository", () => ({
  listAuditLogEvents: mocks.audit,
}));
vi.mock("@/lib/usage/marketing-usage-view", () => ({
  loadMarketingUsageView: mocks.marketing,
}));
vi.mock("@/lib/env/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/env/server")>()),
  getMarketingEnvironment: () => ({ ENABLE_MARKETING_STUDIO: false }),
}));

import { loadUsageDashboard } from "./usage-dashboard";
import { loadEffectiveWorkspaceLimits } from "@/lib/budgets/current-settings";

describe("Usage loader with actual operational environment validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of [
      "OPENAI_API_KEY",
      "TRIGGER_SECRET_KEY",
      "TRIGGER_PROJECT_REF",
    ])
      vi.stubEnv(key, undefined);
    for (const key of [
      "OPENAI_TTS_MODEL",
      "OPENAI_TTS_VOICE",
      "OPENAI_TTS_FORMAT",
      "OPENAI_TTS_SPEED_SCALED_PERCENT",
      "MAX_AUDIO_GENERATIONS_PER_SCENE_VERSION",
      "MAX_SCENES_PER_AUDIO_BATCH",
      "MAX_NARRATION_CHARACTERS",
    ])
      vi.stubEnv(key, "");
    vi.stubEnv("MAX_IMAGES_PER_BATCH", "4");
    vi.stubEnv("MAX_RENDER_DURATION_SECONDS", "180");
    vi.stubEnv("MAX_RENDER_ATTEMPTS", "0");
    mocks.summary.mockResolvedValue(usageView.summary);
    mocks.settings.mockResolvedValue(usageView.settings);
    mocks.ledger.mockResolvedValue(usageView.ledger);
    mocks.audit.mockResolvedValue(usageView.audit);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("loads with unused speech placeholders blank and no provider/worker credentials", async () => {
    const view = await loadUsageDashboard({
      workspaceId: operationsWorkspaceId,
    });
    expect(view.summary).toEqual(usageView.summary);
    expect(view.limitDefaults).toEqual({
      maxImagesPerBatch: 4,
      maxScenesPerAudioBatch: 25,
      maxRenderDurationSeconds: 180,
      maxRetryAttempts: 0,
    });
    expect(view.ledger.items).toEqual(usageView.ledger.items);
    expect(view.audit.items).toEqual(usageView.audit.items);
    expect(view.marketing).toBeNull();
    expect(mocks.marketing).not.toHaveBeenCalled();
    expect(mocks.summary).toHaveBeenCalledWith({
      workspaceId: operationsWorkspaceId,
      now: undefined,
    });
    expect(mocks.ledger).toHaveBeenCalledWith({
      workspaceId: operationsWorkspaceId,
      page: 1,
      pageSize: 20,
    });
    expect(mocks.audit).toHaveBeenCalledWith({
      workspaceId: operationsWorkspaceId,
      page: 1,
      pageSize: 20,
      action: null,
    });
  });

  it("retains workspace overrides and validates actual limit values", async () => {
    expect(
      await loadEffectiveWorkspaceLimits({
        workspaceId: operationsWorkspaceId,
      }),
    ).toEqual({
      maxImagesPerBatch: 4,
      maxScenesPerAudioBatch: 4,
      maxRenderDurationSeconds: 180,
      maxRetryAttempts: 0,
    });
    vi.stubEnv("MAX_SCENES_PER_AUDIO_BATCH", "0");
    await expect(
      loadUsageDashboard({ workspaceId: operationsWorkspaceId }),
    ).rejects.toThrow();
  });
});
