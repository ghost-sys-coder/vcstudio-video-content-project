import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const protect = vi.fn();
const loadCurrentUser = vi.fn();
const upsert = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: { protect },
  currentUser: loadCurrentUser,
}));
vi.mock("@/db/repositories/users.repository", () => ({
  upsertSynchronizedUser: upsert,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`Redirect ${url}`);
  },
}));
afterEach(() => vi.unstubAllEnvs());

describe("authenticated application resource", () => {
  beforeEach(() => {
    protect.mockReset();
    loadCurrentUser.mockReset();
    upsert.mockReset();
  });

  it("rejects unauthenticated users before loading application data", async () => {
    protect.mockRejectedValueOnce(new Error("Unauthenticated"));
    const { requireAuthenticatedUser } =
      await import("@/lib/auth/require-authenticated-user");

    await expect(requireAuthenticatedUser()).rejects.toThrow("Unauthenticated");
    expect(loadCurrentUser).not.toHaveBeenCalled();
  });
  it("blocks an existing signed-in outsider before user provisioning", async () => {
    vi.stubEnv("ENABLE_PRIVATE_ACCESS", "true");
    vi.stubEnv("PRIVATE_ACCESS_CLERK_USER_IDS", "user_owner1,user_owner2");
    loadCurrentUser.mockResolvedValue({ id: "user_other" });
    const { requireAuthenticatedUser } =
      await import("./require-authenticated-user");
    await expect(requireAuthenticatedUser()).rejects.toThrow(
      "Redirect /waitlist",
    );
    expect(upsert).not.toHaveBeenCalled();
  });
  it.each(["user_owner1", "user_owner2"])(
    "preserves the existing account and email for %s",
    async (id) => {
      vi.stubEnv("ENABLE_PRIVATE_ACCESS", "true");
      vi.stubEnv("PRIVATE_ACCESS_CLERK_USER_IDS", "user_owner1,user_owner2");
      loadCurrentUser.mockResolvedValue({
        id,
        primaryEmailAddress: { emailAddress: `${id}@example.com` },
      });
      upsert.mockResolvedValue({ clerkUserId: id });
      const { requireAuthenticatedUser } =
        await import("./require-authenticated-user");
      await expect(requireAuthenticatedUser()).resolves.toEqual({
        clerkUserId: id,
      });
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          clerkUserId: id,
          email: `${id}@example.com`,
        }),
      );
    },
  );
});
