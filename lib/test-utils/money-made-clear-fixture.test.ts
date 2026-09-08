import { describe, expect, it } from "vitest";
import { createMoneyMadeClearFixture } from "@/lib/test-utils/money-made-clear-fixture";
import { buildShortTimeline } from "@/lib/shorts/short-timeline";
import { buildRenderTimelineSnapshot } from "@/lib/render/build-render-snapshot";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";

describe("Money Made Clear production fixture", () => {
  it("assembles the full editorial structure within the agreed long-form envelope", () => {
    const fixture = createMoneyMadeClearFixture();
    expect(fixture.timeline.totalDurationMilliseconds).toBe(609_750);
    expect(fixture.timeline.totalFrames).toBe(18_293);
    expect(fixture.timeline.scenes).toHaveLength(40);
    expect(fixture.timeline).toMatchObject({ width: 1920, height: 1080 });
    expect([...new Set(fixture.scenePlan.map((scene) => scene.stage))]).toEqual(
      [
        "hook",
        "context",
        "explanation",
        "workedExample",
        "supportingVisuals",
        "keyTakeaway",
        "conclusion",
      ],
    );
    expect(
      fixture.rows.every((row) => row.version.characterNames.length === 0),
    ).toBe(true);
    expect(
      new Set(fixture.scenePlan.map((scene) => scene.visualRequirement)).size,
    ).toBe(7);
  });

  it("derives four distinct 45-second candidates with valid timing and original asset identities", () => {
    const fixture = createMoneyMadeClearFixture();
    const sourceVersions = new Set<string>();
    expect(fixture.shortCandidates).toHaveLength(4);
    for (const candidate of fixture.shortCandidates) {
      const { timeline, warnings } = buildShortTimeline({
        source: fixture.timeline,
        clips: candidate.clips,
        width: 1080,
        height: 1920,
      });
      expect(timeline.totalDurationMilliseconds).toBe(45_000);
      expect(timeline.totalFrames).toBe(1350);
      expect(warnings).toEqual([]);
      expect(candidate.targets).toEqual([
        "youtube",
        "tiktok",
        "instagram",
        "facebook",
      ]);
      for (const scene of timeline.scenes) {
        expect(sourceVersions.has(scene.sceneVersionId)).toBe(false);
        sourceVersions.add(scene.sceneVersionId);
        const source = fixture.timeline.scenes.find(
          (row) => row.sceneVersionId === scene.sceneVersionId,
        );
        expect(scene.audio.objectKey).toBe(source?.audio.objectKey);
        expect(scene.image.objectKey).toBe(source?.image.objectKey);
        for (const cue of scene.captions) {
          expect(cue.startMs).toBeGreaterThanOrEqual(scene.startMilliseconds);
          expect(cue.endMs).toBeLessThanOrEqual(scene.endMilliseconds);
        }
      }
    }
  });

  it("keeps the fictional financial example arithmetically consistent and labeled", () => {
    const { illustrativeBudget: budget } = createMoneyMadeClearFixture();
    expect(
      budget.essentialSpending + budget.flexibleSpending + budget.remaining,
    ).toBe(budget.income);
    expect(budget.source).toContain("not observed financial data");
    expect(budget.unit).toBe("neutral illustrative units");
  });

  it.each([true, false])(
    "supports caption inclusion %s without changing timing or adding character animation",
    (includeCaptions) => {
      const fixture = createMoneyMadeClearFixture();
      const snapshot = buildRenderTimelineSnapshot({
        timeline: fixture.timeline,
        captionStyle: DEFAULT_CAPTION_STYLE,
        includeCaptions,
        includeWatermark: false,
      });
      expect(snapshot.totalDurationMilliseconds).toBe(609_750);
      expect(
        snapshot.scenes.every((scene) => scene.characters === undefined),
      ).toBe(true);
      expect(
        snapshot.scenes.every((scene) =>
          includeCaptions
            ? scene.captions.length > 0
            : scene.captions.length === 0,
        ),
      ).toBe(true);
    },
  );
});
