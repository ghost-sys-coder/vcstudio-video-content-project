import { describe, expect, it } from "vitest";
import { CharacterStatusBadge } from "@/components/characters/CharacterStatusBadge";

describe("CharacterStatusBadge", () => {
  it.each([
    ["active", "emerald"],
    ["draft", "amber"],
    ["archived", "slate"],
  ] as const)("uses the %s status palette", (status, palette) => {
    const badge = CharacterStatusBadge({ status });

    expect(badge.props.className).toContain(palette);
    expect(badge.props.children[1]).toBe(status);
  });
});
