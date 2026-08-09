import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => ({ R2_BUCKET_NAME: "private-bucket" }),
}));
vi.mock("@/lib/storage/r2-client", () => ({
  getR2Client: () => ({ send: mocks.send }),
}));

import {
  assertSafeReconciliationObjectKey,
  deleteReconciliationObject,
} from "@/lib/storage/reconciliation-storage";

describe("reconciliation storage", () => {
  beforeEach(() => mocks.send.mockReset().mockResolvedValue({}));

  it("deletes one exact workspace-scoped key", async () => {
    const key =
      "workspaces/11111111-1111-4111-8111-111111111111/projects/22222222-2222-4222-8222-222222222222/renders/33333333-3333-4333-8333-333333333333.mp4";
    await deleteReconciliationObject(key);
    expect(Reflect.get(mocks.send.mock.calls[0]![0], "input")).toEqual({
      Bucket: "private-bucket",
      Key: key,
    });
  });

  it.each([
    "../other-bucket/secret",
    "/workspaces/111/file",
    "workspaces/111/../../secret",
    "unscoped/file.mp4",
  ])("rejects unsafe or traversing key %s", (key) => {
    expect(() => assertSafeReconciliationObjectKey(key)).toThrow(
      "UNSAFE_RECONCILIATION_OBJECT_KEY",
    );
  });
});
