import { describe, expect, it } from "vitest";
import { renderSceneOutpaintPrompt } from "./scene-outpaint";

describe("renderSceneOutpaintPrompt", () => {
  it("locks the source image while naming the exact output", () => {
    const prompt = renderSceneOutpaintPrompt({
      aspectRatio: "9:16",
      width: 1080,
      height: 1920,
    });
    expect(prompt).toContain("9:16, 1080x1920");
    expect(prompt).toContain("without changing its existing content");
    expect(prompt).toContain("Do not add text");
  });
});
