import { describe, expect, it } from "vitest";
import {
  ANIMATION_TEST_DURATION_IN_FRAMES,
  ANIMATION_TEST_FPS,
  ANIMATION_TEST_SPEAKING_FRAMES,
  createAnimationTestEnvelope,
} from "@/lib/characters/animation-test-envelope";

// Mirrors the sprite's own talking threshold; if that constant moves, this test
// is the place that notices the synthetic envelope no longer exercises both
// mouth states.
const TALK_AMPLITUDE_THRESHOLD = 0.12;

function speakingEnvelope(): number[] {
  return createAnimationTestEnvelope({
    frameCount: ANIMATION_TEST_SPEAKING_FRAMES,
    framesPerSecond: ANIMATION_TEST_FPS,
  });
}

describe("createAnimationTestEnvelope", () => {
  it("produces one value per frame", () => {
    expect(speakingEnvelope()).toHaveLength(ANIMATION_TEST_SPEAKING_FRAMES);
  });

  it("stays within the 0..1 range the renderer expects", () => {
    for (const value of speakingEnvelope()) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("crosses the talking threshold in both directions", () => {
    const envelope = speakingEnvelope();
    expect(envelope.some((value) => value >= TALK_AMPLITUDE_THRESHOLD)).toBe(
      true,
    );
    expect(envelope.some((value) => value < TALK_AMPLITUDE_THRESHOLD)).toBe(
      true,
    );
  });

  it("includes silent breaths between phrases", () => {
    expect(speakingEnvelope().some((value) => value === 0)).toBe(true);
  });

  it("is deterministic", () => {
    expect(speakingEnvelope()).toEqual(speakingEnvelope());
  });

  it("returns the same signal at any frame rate", () => {
    const atThirty = createAnimationTestEnvelope({
      frameCount: 30,
      framesPerSecond: 30,
    });
    const atSixty = createAnimationTestEnvelope({
      frameCount: 60,
      framesPerSecond: 60,
    });
    // One second of signal either way, so every 30fps frame has a 60fps twin.
    for (let frame = 0; frame < 30; frame++) {
      expect(atSixty[frame * 2]).toBeCloseTo(atThirty[frame] ?? 0, 10);
    }
  });

  it("degrades to an empty envelope instead of throwing", () => {
    expect(
      createAnimationTestEnvelope({ frameCount: 0, framesPerSecond: 30 }),
    ).toEqual([]);
    expect(
      createAnimationTestEnvelope({ frameCount: 30, framesPerSecond: 0 }),
    ).toEqual([]);
  });

  it("leaves an idle tail past the end of the envelope", () => {
    // The sprite reads a frame past the envelope as idle, so the check's
    // duration must exceed the envelope it is given.
    expect(ANIMATION_TEST_DURATION_IN_FRAMES).toBeGreaterThan(
      ANIMATION_TEST_SPEAKING_FRAMES,
    );
  });
});
