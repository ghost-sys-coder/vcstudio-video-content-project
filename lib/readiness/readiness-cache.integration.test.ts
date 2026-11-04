import "next/dist/server/node-environment-baseline";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadSnapshot: vi.fn(), send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/db/repositories/readiness.repository", () => ({
  loadReadinessDatabaseSnapshot: mocks.loadSnapshot,
}));
vi.mock("@/lib/storage/r2-client", () => ({
  getR2Client: () => ({ send: mocks.send }),
}));

import { ReadinessOverview } from "@/components/readiness/ReadinessOverview";
import { loadCachedOperationalReadiness } from "./readiness";

type StoredCacheValue = { kind: "FETCH"; data: { body: string } };
const firstWorkspace = "11111111-1111-4111-8111-111111111111";
const secondWorkspace = "22222222-2222-4222-8222-222222222222";

describe("readiness through the Next.js data cache", () => {
  beforeEach(() => {
    const entries = new Map<string, StoredCacheValue>();
    // Use Next's actual unstable_cache serialization, with an isolated backing
    // store instead of the deployed cache. Database and storage stay mocked.
    vi.stubGlobal("__incrementalCache", {
      generateSimpleCacheKey: async (key: string) => key,
      get: async (key: string) => {
        const value = entries.get(key);
        return value ? { value, isStale: false } : null;
      },
      set: async (key: string, value: StoredCacheValue) => {
        entries.set(key, value);
      },
    });
    vi.stubEnv("R2_BUCKET_NAME", "readiness-test-bucket");
    vi.stubEnv("R2_ENDPOINT", "https://r2.example.com");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
    mocks.send.mockReset().mockResolvedValue({});
    mocks.loadSnapshot
      .mockReset()
      .mockImplementation(async ({ workspaceId }: { workspaceId: string }) => ({
        heartbeat: null,
        connections: [],
        googleBusiness: null,
        stuckCount: workspaceId === firstWorkspace ? 1 : 0,
        schemaCompatible: true,
      }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("renders the same check time on cache miss and cache hit without repeating probes", async () => {
    const fresh = await loadCachedOperationalReadiness(firstWorkspace);
    const cached = await loadCachedOperationalReadiness(firstWorkspace);

    expect(cached).toEqual(fresh);
    const freshMarkup = renderToStaticMarkup(
      createElement(ReadinessOverview, { view: fresh }),
    );
    const cachedMarkup = renderToStaticMarkup(
      createElement(ReadinessOverview, { view: cached }),
    );
    expect(cachedMarkup).toContain(`<time dateTime="${cached.checkedAt}">`);
    expect(cachedMarkup).toContain("UTC</time>");
    expect(cachedMarkup).toBe(freshMarkup);
    expect(mocks.loadSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it("keeps cached workspace checks isolated", async () => {
    const first = await loadCachedOperationalReadiness(firstWorkspace);
    const second = await loadCachedOperationalReadiness(secondWorkspace);
    const firstAgain = await loadCachedOperationalReadiness(firstWorkspace);

    expect(first.workspace.find((item) => item.id === "stuck")?.status).toBe(
      "degraded",
    );
    expect(second.workspace.find((item) => item.id === "stuck")?.status).toBe(
      "ready",
    );
    expect(firstAgain).toEqual(first);
    expect(mocks.loadSnapshot).toHaveBeenCalledTimes(2);
  });
});
