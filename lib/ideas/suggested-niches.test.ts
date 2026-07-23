import { describe, expect, it } from "vitest";
import { SUGGESTED_NICHES } from "@/lib/ideas/suggested-niches";

describe("SUGGESTED_NICHES", () => {
  it("offers a non-empty set of distinct, non-blank niches", () => {
    expect(SUGGESTED_NICHES.length).toBeGreaterThan(0);
    expect(new Set(SUGGESTED_NICHES).size).toBe(SUGGESTED_NICHES.length);
    for (const niche of SUGGESTED_NICHES) expect(niche.trim()).not.toBe("");
  });
});
