import { describe, expect, it } from "vitest";
import { renderMarketingSkillPrompt } from "./marketing-skill";
describe("renderMarketingSkillPrompt", () => {
  it("renders deterministic inputs and grounding rules", () => {
    const prompt = renderMarketingSkillPrompt({
      skillLabel: "Post",
      instructions: "Write it.",
      inputs: { topic: "Launch", platform: "x" },
      brandContext: "Verified brand facts",
    });
    expect(prompt.indexOf("platform: x")).toBeLessThan(
      prompt.indexOf("topic: Launch"),
    );
    expect(prompt).toContain("Verified brand facts");
    expect(prompt).toContain("Do not invent prices");
  });
});
