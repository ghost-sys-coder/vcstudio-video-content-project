import { describe, expect, it } from "vitest";
import { createProductionBaselineFixture } from "@/lib/test-utils/version-two-production-fixture";
import { anchorShortClips, resolveShortClips } from "./short-anchors";
import { buildShortTimeline } from "./short-timeline";

function setup() {
  const fixture = createProductionBaselineFixture();
  const clips = anchorShortClips(fixture.clips, fixture.timeline).map(
    (clip) => ({ ...clip, createdAt: new Date("2026-09-08T01:00:00Z") }),
  );
  return { ...fixture, clips };
}

describe("relative Short anchors", () => {
  it("rebases across earlier timing and compatible source revisions without changing saved trims or content", () => {
    const { clips, timeline, rows } = setup();
    const saved = JSON.stringify(clips);
    const shifted = {
      ...timeline,
      scenes: timeline.scenes.map((scene) => ({
        ...scene,
        sceneVersionId: `${scene.sceneVersionId}-revised`,
        startMilliseconds: scene.startMilliseconds + 5000,
        endMilliseconds: scene.endMilliseconds + 5000,
        captions: scene.captions.map((caption) => ({
          ...caption,
          startMs: caption.startMs + 5000,
          endMs: caption.endMs + 5000,
        })),
      })),
    };
    const result = resolveShortClips(clips, shifted, rows);
    expect(result.needsReview).toBe(false);
    expect(result.clips[0]!.sourceStartMilliseconds).toBe(
      clips[0]!.sourceStartMilliseconds + 5000,
    );
    const before = buildShortTimeline({
      source: timeline,
      clips,
      width: 1080,
      height: 1920,
    }).timeline;
    const after = buildShortTimeline({
      source: shifted,
      clips: result.clips,
      width: 1080,
      height: 1920,
    }).timeline;
    expect(after.totalDurationMilliseconds).toBe(
      before.totalDurationMilliseconds,
    );
    expect(
      after.scenes.map((scene) => ({
        audio: scene.audio,
        captions: scene.captions,
      })),
    ).toEqual(
      before.scenes.map((scene) => ({
        audio: scene.audio,
        captions: scene.captions,
      })),
    );
    expect(JSON.stringify(clips)).toBe(saved);
  });

  it.each(["audio", "missing", "shorter"] as const)(
    "requires review for %s source",
    (change) => {
      const { clips, timeline, rows } = setup();
      const changed = structuredClone(timeline);
      const source = changed.scenes.find(
        (scene) => scene.sceneId === clips[0]!.sourceSceneId,
      )!;
      if (change === "audio") source.audio.generationId = "replacement";
      if (change === "shorter")
        source.endMilliseconds = source.startMilliseconds + 1;
      if (change === "missing")
        changed.scenes = changed.scenes.filter((scene) => scene !== source);
      expect(resolveShortClips(clips, changed, rows).needsReview).toBe(true);
    },
  );

  it("keeps legacy ranges conservative until explicit resave", () => {
    const fixture = createProductionBaselineFixture();
    const clips = fixture.clips.map((clip) => ({
      ...clip,
      createdAt: new Date("2026-09-08T01:00:00Z"),
    }));
    fixture.rows[0]!.version.createdAt = new Date("2026-09-08T02:00:00Z");
    expect(
      resolveShortClips(clips, fixture.timeline, fixture.rows).needsReview,
    ).toBe(true);
    expect(
      resolveShortClips(
        anchorShortClips(clips, fixture.timeline),
        fixture.timeline,
        fixture.rows,
      ).needsReview,
    ).toBe(false);
  });

  it("refuses stale or out-of-bounds sources when capturing anchors", () => {
    const { clips, timeline } = setup();
    expect(() =>
      anchorShortClips(
        [{ ...clips[0]!, sourceSceneVersionId: "stale" }],
        timeline,
      ),
    ).toThrow(RangeError);
    expect(() =>
      anchorShortClips(
        [{ ...clips[0]!, sourceEndMilliseconds: 1_000_000 }],
        timeline,
      ),
    ).toThrow(RangeError);
  });
});
