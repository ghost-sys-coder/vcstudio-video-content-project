import { describe, expect, it } from "vitest";
import {
  assertGenerationApprovalGrant,
  effectiveGenerationApprovalMode,
} from "./generation-approval-policy";
describe("owner-authorized generation autonomy", () => {
  it("defaults to manual and never promotes editors or viewers", () => {
    expect(effectiveGenerationApprovalMode({ role: "owner" })).toBe("manual");
    for (const role of ["editor", "viewer"] as const)
      expect(
        effectiveGenerationApprovalMode({
          role,
          generationApprovalMode: "autonomous",
        }),
      ).toBe("manual");
    expect(
      effectiveGenerationApprovalMode({
        role: "owner",
        generationApprovalMode: "autonomous",
      }),
    ).toBe("autonomous");
  });
  it("requires owner role AND the dedicated Generate scope", () => {
    for (const role of ["editor", "viewer"] as const)
      expect(() =>
        assertGenerationApprovalGrant({
          role,
          scopes: ["vcstudio:generate"],
          generationApprovalMode: "autonomous",
        }),
      ).toThrow();
    expect(() =>
      assertGenerationApprovalGrant({
        role: "owner",
        scopes: ["vcstudio:publish"],
        generationApprovalMode: "autonomous",
      }),
    ).toThrow();
    expect(() =>
      assertGenerationApprovalGrant({
        role: "owner",
        scopes: ["vcstudio:generate"],
        generationApprovalMode: "autonomous",
      }),
    ).not.toThrow();
  });
});
