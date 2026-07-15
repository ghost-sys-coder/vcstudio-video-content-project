import { describe, expect, it } from "vitest";
import { assertScriptVersionDeletable } from "@/lib/domain/script-version-deletion";

describe("assertScriptVersionDeletable", () => {
  it("allows an unreferenced draft or superseded version", () => {
    expect(() =>
      assertScriptVersionDeletable({ status: "draft", referenceCount: 0 }),
    ).not.toThrow();
    expect(() =>
      assertScriptVersionDeletable({
        status: "superseded",
        referenceCount: 0,
      }),
    ).not.toThrow();
  });

  it("rejects approved versions", () => {
    expect(() =>
      assertScriptVersionDeletable({ status: "approved", referenceCount: 0 }),
    ).toThrow("SCRIPT_VERSION_APPROVED");
  });

  it("rejects versions referenced by scene analysis", () => {
    expect(() =>
      assertScriptVersionDeletable({ status: "draft", referenceCount: 1 }),
    ).toThrow("SCRIPT_VERSION_REFERENCED");
  });
});
