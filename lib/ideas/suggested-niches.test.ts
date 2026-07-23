import { describe, expect, it } from "vitest";
import { SUGGESTED_NICHES } from "@/lib/ideas/suggested-niches";

describe("SUGGESTED_NICHES", () => {
  it("offers a non-empty set of distinct niches, each with a tone", () => {
    expect(SUGGESTED_NICHES.length).toBeGreaterThan(0);
    const niches = SUGGESTED_NICHES.map((entry) => entry.niche);
    expect(new Set(niches).size).toBe(niches.length);
    for (const entry of SUGGESTED_NICHES) {
      expect(entry.niche.trim()).not.toBe("");
      expect(entry.tone.trim()).not.toBe("");
    }
  });
});
