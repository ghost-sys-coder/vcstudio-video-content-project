import { describe, expect, it } from "vitest";
import {
  deriveSceneCameraMotion,
  deriveSceneTransition,
} from "@/lib/render/scene-motion";

describe("deriveSceneCameraMotion", () => {
  it("is deterministic and cycles through the subtle moves", () => {
    expect(deriveSceneCameraMotion(1)).toBe("zoomIn");
    expect(deriveSceneCameraMotion(2)).toBe("zoomOut");
    expect(deriveSceneCameraMotion(3)).toBe("panLeft");
    expect(deriveSceneCameraMotion(4)).toBe("panRight");
    expect(deriveSceneCameraMotion(5)).toBe("zoomIn");
    expect(deriveSceneCameraMotion(7)).toBe(deriveSceneCameraMotion(7));
  });

  it("rejects invalid scene numbers", () => {
    expect(() => deriveSceneCameraMotion(0)).toThrow(RangeError);
  });
});

describe("deriveSceneTransition", () => {
  it("cuts the first scene and fades the rest", () => {
    expect(deriveSceneTransition(1)).toBe("cut");
    expect(deriveSceneTransition(2)).toBe("fade");
    expect(deriveSceneTransition(20)).toBe("fade");
  });
});
