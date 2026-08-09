import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadSnapshot: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/repositories/readiness.repository", () => ({
  loadReadinessDatabaseSnapshot: mocks.loadSnapshot,
}));
vi.mock("@/lib/storage/r2-client", () => ({
  getR2Client: () => ({ send: mocks.send }),
}));

import { loadOperationalReadiness } from "@/lib/readiness/readiness";

const originalEnvironment = { ...process.env };

describe("operational readiness", () => {
  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      READINESS_ENVIRONMENT: "development",
      R2_BUCKET_NAME: "bucket",
      R2_ENDPOINT: "https://r2.example.com",
      R2_ACCESS_KEY_ID: "secret-id",
      R2_SECRET_ACCESS_KEY: "secret-key",
      ENABLE_VIDEO_PUBLISHING: "true",
    };
    mocks.send.mockReset().mockResolvedValue({});
    mocks.loadSnapshot
      .mockReset()
      .mockResolvedValue({
        heartbeat: null,
        connections: [],
        googleBusiness: null,
        stuckCount: 0,
        schemaCompatible: true,
      });
  });
  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it("distinguishes a missing worker, disabled optional connection, and missing authorization", async () => {
    const view = await loadOperationalReadiness(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(view.deployment.find((item) => item.id === "worker")?.status).toBe(
      "unknown",
    );
    expect(
      view.workspace.find((item) => item.id === "google-business")?.status,
    ).toBe("disabled");
    expect(
      view.workspace.find((item) => item.id === "connections")?.status,
    ).toBe("blocked");
  });

  it("never serializes configured credential values", async () => {
    const serialized = JSON.stringify(
      await loadOperationalReadiness("11111111-1111-4111-8111-111111111111"),
    );
    expect(serialized).not.toContain("secret-id");
    expect(serialized).not.toContain("secret-key");
  });
});
