import { describe, it, expect } from "vitest";
import { orderedVideoInputs } from "./video-input-order";
describe("provider frame order", () => {
  it("delivers first frame before last without mutating saved inputs", () => {
    const inputs = [
      { role: "last_frame", id: 2 },
      { role: "first_frame", id: 1 },
    ];
    expect(
      orderedVideoInputs("image_to_video", inputs).map((item) => item.id),
    ).toEqual([1, 2]);
    expect(inputs[0]!.id).toBe(2);
  });
  it("preserves reference sequence rather than sorting role names", () => {
    const inputs = [
      { role: "style" },
      { role: "character" },
      { role: "reference" },
    ];
    expect(orderedVideoInputs("reference_to_video", inputs)).toEqual(inputs);
  });
});
