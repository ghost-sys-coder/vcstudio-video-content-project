import { beforeEach, describe, expect, it, vi } from "vitest";

const protect = vi.fn();
const loadCurrentUser = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: { protect },
  currentUser: loadCurrentUser,
}));
vi.mock("@/db/repositories/users.repository", () => ({
  upsertSynchronizedUser: vi.fn(),
}));

describe("authenticated application resource", () => {
  beforeEach(() => {
    protect.mockReset();
    loadCurrentUser.mockReset();
  });

  it("rejects unauthenticated users before loading application data", async () => {
    protect.mockRejectedValueOnce(new Error("Unauthenticated"));
    const { requireAuthenticatedUser } =
      await import("@/lib/auth/require-authenticated-user");

    await expect(requireAuthenticatedUser()).rejects.toThrow("Unauthenticated");
    expect(loadCurrentUser).not.toHaveBeenCalled();
  });
});
