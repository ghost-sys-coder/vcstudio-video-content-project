import { describe, expect, it } from "vitest";
import { getUserInitials } from "@/lib/users/user-initials";

describe("getUserInitials", () => {
  it("uses first and last initial for a full name", () => {
    expect(getUserInitials("Ada Lovelace")).toBe("AL");
    expect(getUserInitials("  mary jane  watson ")).toBe("MW");
  });

  it("uses the first two letters of a single name", () => {
    expect(getUserInitials("Prince")).toBe("PR");
  });

  it("falls back to the email when there is no name", () => {
    expect(getUserInitials("", "junior@example.com")).toBe("JU");
  });

  it("returns a placeholder when nothing is available", () => {
    expect(getUserInitials("", "")).toBe("?");
    expect(getUserInitials("   ")).toBe("?");
  });
});
