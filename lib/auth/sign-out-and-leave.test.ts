import { describe, expect, it, vi } from "vitest";
import { signOutAndLeave } from "./sign-out-and-leave";

describe("signOutAndLeave", () => {
  it("navigates to the destination when Clerk runs the callback", async () => {
    const navigate = vi.fn();
    const signOut = vi.fn(async (callback: () => void) => {
      callback();
    });

    await signOutAndLeave({ destination: "/", navigate, signOut });

    expect(navigate).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("hands Clerk a callback rather than a redirect option", async () => {
    // The callback overload is what suppresses Clerk's own soft navigation, so
    // a plain function argument is the contract this relies on.
    let received: unknown = null;
    const signOut = vi.fn(async (callback: () => void) => {
      received = callback;
    });

    await signOutAndLeave({
      destination: "/invite/abc/accept",
      navigate: vi.fn(),
      signOut,
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(typeof received).toBe("function");
  });

  it("does not navigate when sign out never invokes the callback", async () => {
    const navigate = vi.fn();

    await signOutAndLeave({
      destination: "/",
      navigate,
      signOut: async () => undefined,
    });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("rejects without navigating when sign out fails", async () => {
    const navigate = vi.fn();

    await expect(
      signOutAndLeave({
        destination: "/",
        navigate,
        signOut: async () => {
          throw new Error("network");
        },
      }),
    ).rejects.toThrow("network");
    expect(navigate).not.toHaveBeenCalled();
  });
});
