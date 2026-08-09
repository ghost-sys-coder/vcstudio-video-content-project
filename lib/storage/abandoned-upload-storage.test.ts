import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => ({ R2_BUCKET_NAME: "bucket" }),
}));
vi.mock("@/lib/storage/r2-client", () => ({
  getR2Client: () => ({ send: mocks.send }),
}));

import { listWorkspaceObjectsForReconciliation } from "@/lib/storage/abandoned-upload-storage";

describe("abandoned upload listing", () => {
  beforeEach(() => mocks.send.mockReset());

  it("uses a bounded workspace prefix and advances by exact key", async () => {
    const key =
      "workspaces/11111111-1111-4111-8111-111111111111/library/a.webp";
    mocks.send.mockResolvedValue({
      Contents: [{ Key: key, LastModified: new Date("2026-08-01") }],
      IsTruncated: true,
    });
    const result = await listWorkspaceObjectsForReconciliation({
      startAfter: null,
      limit: 25,
    });
    const input = Reflect.get(mocks.send.mock.calls[0]![0], "input");
    expect(input).toMatchObject({
      Bucket: "bucket",
      Prefix: "workspaces/",
      MaxKeys: 25,
    });
    expect(result.nextStartAfter).toBe(key);
  });

  it("rejects an unsafe returned key", async () => {
    mocks.send.mockResolvedValue({
      Contents: [{ Key: "workspaces/../secret", LastModified: new Date() }],
    });
    await expect(
      listWorkspaceObjectsForReconciliation({ startAfter: null, limit: 10 }),
    ).rejects.toThrow("UNSAFE_RECONCILIATION_OBJECT_KEY");
  });
});
