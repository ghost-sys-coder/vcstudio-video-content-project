import { describe, expect, it } from "vitest";
import { buildAnimationTestCharacter } from "@/lib/characters/build-animation-test-character";
import { ANIMATION_TEST_SPEAKING_FRAMES } from "@/lib/characters/animation-test-envelope";
import {
  ANIMATION_POSE_KEYS,
  type AnimationPoseDiagnostic,
} from "@/lib/characters/animation-check-view";

const CHARACTER_ID = "33333333-3333-4333-8333-333333333333";

function poses(): AnimationPoseDiagnostic[] {
  return ANIMATION_POSE_KEYS.map((pose) => ({
    pose,
    present: true,
    contentType: "image/png",
    width: 1024,
    height: 1024,
    hasAlphaChannel: true,
    transparentShareBps: 6000,
    cornersTransparent: true,
    previewUrl: `https://storage.example/${pose}.png?signed`,
  }));
}

describe("buildAnimationTestCharacter", () => {
  it("maps each pose to its own signed URL", () => {
    const character = buildAnimationTestCharacter({
      characterId: CHARACTER_ID,
      poses: poses(),
      faceLeft: false,
    });
    expect(character).not.toBeNull();
    expect(character?.idleUrl).toContain("idle.png");
    expect(character?.talkOpenUrl).toContain("talkOpen.png");
    expect(character?.talkClosedUrl).toContain("talkClosed.png");
    expect(character?.blinkUrl).toContain("blink.png");
  });

  it("drives the sprite as the speaker with a full-length envelope", () => {
    const character = buildAnimationTestCharacter({
      characterId: CHARACTER_ID,
      poses: poses(),
      faceLeft: false,
    });
    expect(character?.isSpeaker).toBe(true);
    expect(character?.stageSlot).toBe("center");
    expect(character?.amplitudeEnvelope).toHaveLength(
      ANIMATION_TEST_SPEAKING_FRAMES,
    );
  });

  it("passes the mirror flag through so facing can be checked", () => {
    const character = buildAnimationTestCharacter({
      characterId: CHARACTER_ID,
      poses: poses(),
      faceLeft: true,
    });
    expect(character?.faceLeft).toBe(true);
  });

  it("returns null when a pose has no signed URL", () => {
    const incomplete = poses().map((pose) =>
      pose.pose === "blink" ? { ...pose, previewUrl: null } : pose,
    );
    expect(
      buildAnimationTestCharacter({
        characterId: CHARACTER_ID,
        poses: incomplete,
        faceLeft: false,
      }),
    ).toBeNull();
  });
});
