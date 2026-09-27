import { describe, expect, it } from "vitest";
import {
  appendChaptersToDescription,
  buildChaptersFromScenePicks,
  canHaveChapters,
  cleanChapterTitle,
  findChaptersOffSceneStarts,
  formatChapterBlock,
  formatChapterTimestamp,
  isShortsShaped,
  resolvePublishDescription,
  targetChapterRange,
  validateChapters,
  type VideoChapter,
} from "@/lib/chapters/youtube-chapters";

const MINUTE = 60_000;

function chapters(...entries: [number, string][]): VideoChapter[] {
  return entries.map(([startMilliseconds, title]) => ({
    startMilliseconds,
    title,
  }));
}

describe("formatChapterTimestamp", () => {
  it("writes minutes and seconds, flooring to the second", () => {
    expect(formatChapterTimestamp(0, 5 * MINUTE)).toBe("0:00");
    expect(formatChapterTimestamp(65_999, 5 * MINUTE)).toBe("1:05");
    expect(formatChapterTimestamp(12 * MINUTE + 3_000, 20 * MINUTE)).toBe(
      "12:03",
    );
  });

  it("adds hours to every line once the video reaches an hour", () => {
    expect(formatChapterTimestamp(0, 61 * MINUTE)).toBe("0:00:00");
    expect(formatChapterTimestamp(62 * MINUTE + 3_000, 70 * MINUTE)).toBe(
      "1:02:03",
    );
  });
});

describe("validateChapters", () => {
  const valid = chapters(
    [0, "Intro"],
    [40_000, "The problem"],
    [95_000, "The fix"],
  );

  it("accepts a list YouTube will show", () => {
    expect(validateChapters(valid, 3 * MINUTE)).toEqual([]);
  });

  it("names every rule YouTube would silently reject", () => {
    const messages = (list: VideoChapter[], duration = 3 * MINUTE) =>
      validateChapters(list, duration).map((issue) => issue.message);

    expect(messages(valid.slice(0, 2))).toContain(
      "YouTube needs at least 3 chapters.",
    );
    expect(
      messages(chapters([2_000, "A"], [40_000, "B"], [95_000, "C"])),
    ).toContain("The first chapter must start at 0:00.");
    expect(
      messages(chapters([0, "A"], [40_000, "B"], [45_000, "C"])).join(" "),
    ).toMatch(/at least 10 seconds; this one lasts 5/);
    expect(
      messages(chapters([0, "A"], [95_000, "B"], [40_000, "C"])),
    ).toContain("Chapters must be in order, each starting after the last.");
    expect(
      messages(chapters([0, "A"], [40_000, " "], [95_000, "C"])),
    ).toContain("Give this chapter a title.");
    expect(
      messages(chapters([0, "A"], [40_000, "B"], [200_000, "C"])),
    ).toContain("This chapter starts outside the video.");
  });

  it("measures the last chapter against the end of the video", () => {
    expect(
      validateChapters(valid, 100_000).some((issue) => issue.index === 2),
    ).toBe(true);
  });

  it("judges length in the whole seconds YouTube reads", () => {
    // 9.9 s apart in milliseconds, but 10 s apart once floored the same way.
    expect(
      validateChapters(
        chapters([0, "A"], [10_050, "B"], [20_900, "C"]),
        31_000,
      ),
    ).toEqual([]);
  });
});

describe("formatChapterBlock", () => {
  it("writes one timestamped line per chapter", () => {
    expect(
      formatChapterBlock(
        chapters(
          [0, "Intro"],
          [65_000, "  The   problem "],
          [125_000, "3:10 Wrap up"],
        ),
        4 * MINUTE,
      ),
    ).toBe("0:00 Intro\n1:05 The problem\n2:05 Wrap up");
  });
});

describe("appendChaptersToDescription", () => {
  const block = "0:00 Intro\n1:05 The problem\n2:05 Wrap up";

  it("adds the block after the description", () => {
    expect(appendChaptersToDescription("Great video.\n", block)).toEqual({
      applied: true,
      description: `Great video.\n\n${block}`,
    });
    expect(appendChaptersToDescription("", block)).toEqual({
      applied: true,
      description: block,
    });
  });

  it("leaves a description that already has chapters alone", () => {
    const result = appendChaptersToDescription(
      "About this.\n0:00 Start\n1:00 Middle",
      block,
    );
    expect(result.applied).toBe(false);
    expect(result).toMatchObject({ reason: "already_present" });
  });

  it("refuses rather than truncating when it would not fit", () => {
    const result = appendChaptersToDescription("x".repeat(4_990), block);
    expect(result).toMatchObject({ applied: false, reason: "too_long" });
    expect(result.description).toBe("x".repeat(4_990));
  });
});

describe("buildChaptersFromScenePicks", () => {
  const scenes = [
    { sceneNumber: 1, startMilliseconds: 0 },
    { sceneNumber: 2, startMilliseconds: 8_000 },
    { sceneNumber: 3, startMilliseconds: 30_000 },
    { sceneNumber: 4, startMilliseconds: 62_500 },
    { sceneNumber: 5, startMilliseconds: 70_000 },
    { sceneNumber: 6, startMilliseconds: 110_000 },
  ];

  it("places each pick at its scene's rendered start", () => {
    expect(
      buildChaptersFromScenePicks({
        picks: [
          { startSceneNumber: 1, title: "Intro" },
          { startSceneNumber: 3, title: "Setup" },
          { startSceneNumber: 6, title: "Payoff" },
        ],
        scenes,
        videoDurationMilliseconds: 150_000,
      }),
    ).toEqual(chapters([0, "Intro"], [30_000, "Setup"], [110_000, "Payoff"]));
  });

  it("pins the first chapter to 0:00 and drops unknown or repeated scenes", () => {
    const result = buildChaptersFromScenePicks({
      picks: [
        { startSceneNumber: 3, title: "Setup" },
        { startSceneNumber: 3, title: "Setup again" },
        { startSceneNumber: 99, title: "Nowhere" },
        { startSceneNumber: 6, title: "Payoff" },
        { startSceneNumber: 4, title: "Turn" },
      ],
      scenes,
      videoDurationMilliseconds: 150_000,
    });
    expect(result).toEqual(
      chapters([0, "Setup"], [62_500, "Turn"], [110_000, "Payoff"]),
    );
    expect(validateChapters(result, 150_000)).toEqual([]);
  });

  it("folds a chapter too short to count into the one before it", () => {
    const result = buildChaptersFromScenePicks({
      picks: [
        { startSceneNumber: 1, title: "Cold open" },
        { startSceneNumber: 2, title: "Intro" },
        { startSceneNumber: 3, title: "Setup" },
        { startSceneNumber: 4, title: "Turn" },
        { startSceneNumber: 5, title: "Twist" },
        { startSceneNumber: 6, title: "Payoff" },
      ],
      scenes,
      videoDurationMilliseconds: 115_000,
    });
    // 0→8 s and 62.5→70 s are too short, and the last runs only 5 s.
    expect(result.map((chapter) => chapter.title)).toEqual([
      "Cold open",
      "Setup",
      "Turn",
    ]);
    expect(validateChapters(result, 115_000)).toEqual([]);
  });
});

describe("targetChapterRange and eligibility", () => {
  it("scales with length within YouTube's floor", () => {
    expect(targetChapterRange(2 * MINUTE)).toEqual({ minimum: 3, maximum: 3 });
    expect(targetChapterRange(10 * MINUTE)).toEqual({
      minimum: 7,
      maximum: 13,
    });
    expect(targetChapterRange(60 * MINUTE).maximum).toBe(15);
  });

  it("refuses videos too short for three chapters, and Shorts", () => {
    expect(canHaveChapters(29_999)).toBe(false);
    expect(canHaveChapters(30_000)).toBe(true);
    expect(isShortsShaped({ width: 1080, height: 1920 })).toBe(true);
    expect(isShortsShaped({ width: 1920, height: 1080 })).toBe(false);
  });

  it("strips list numbering from a title", () => {
    expect(cleanChapterTitle("2. The fix")).toBe("The fix");
  });
});

describe("resolvePublishDescription", () => {
  const landscape = { width: 1920, height: 1080 };
  const list = chapters([0, "Intro"], [40_000, "Middle"], [95_000, "End"]);

  it("adds valid chapters to the description", () => {
    expect(
      resolvePublishDescription({
        description: "About this video.",
        chapters: list,
        includeInYouTubeDescription: true,
        videoDurationMilliseconds: 3 * MINUTE,
        dimensions: landscape,
      }),
    ).toEqual({
      ok: true,
      chaptersAdded: true,
      description: "About this video.\n\n0:00 Intro\n0:40 Middle\n1:35 End",
    });
  });

  it("leaves the description alone when chapters are off, absent, or a Short", () => {
    for (const override of [
      { includeInYouTubeDescription: false },
      { chapters: null },
      { dimensions: { width: 1080, height: 1920 } },
    ])
      expect(
        resolvePublishDescription({
          description: "Keep me.",
          chapters: list,
          includeInYouTubeDescription: true,
          videoDurationMilliseconds: 3 * MINUTE,
          dimensions: landscape,
          ...override,
        }),
      ).toEqual({ ok: true, description: "Keep me.", chaptersAdded: false });
  });

  it("refuses, with the reason, instead of publishing chapters YouTube would drop", () => {
    const broken = resolvePublishDescription({
      description: "",
      chapters: list.slice(0, 2),
      includeInYouTubeDescription: true,
      videoDurationMilliseconds: 3 * MINUTE,
      dimensions: landscape,
    });
    expect(broken).toMatchObject({ ok: false });
    expect(broken.ok ? "" : broken.error).toMatch(/at least 3 chapters/);

    const tooLong = resolvePublishDescription({
      description: "x".repeat(4_990),
      chapters: list,
      includeInYouTubeDescription: true,
      videoDurationMilliseconds: 3 * MINUTE,
      dimensions: landscape,
    });
    expect(tooLong.ok ? "" : tooLong.error).toMatch(/5,000-character limit/);
  });
});

describe("findChaptersOffSceneStarts", () => {
  it("flags a chapter that does not start on a scene", () => {
    const scenes = [
      { sceneNumber: 1, startMilliseconds: 0 },
      { sceneNumber: 2, startMilliseconds: 12_400 },
    ];
    expect(
      findChaptersOffSceneStarts(
        chapters([0, "A"], [12_400, "B"], [13_000, "C"]),
        scenes,
      ),
    ).toEqual([2]);
  });
});
