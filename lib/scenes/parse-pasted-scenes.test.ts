import { describe, expect, it } from "vitest";
import {
  estimateSceneDurationMilliseconds,
  MAXIMUM_PASTED_SCENES,
  parsePastedScenes,
} from "@/lib/scenes/parse-pasted-scenes";
import {
  SCENE_ARRAY_TEMPLATE_JSON,
  SCENE_TEMPLATE,
  SCENE_TEMPLATE_JSON,
} from "@/lib/scenes/scene-template";

const complete = {
  narrationText: "Inflation is quietly reshaping your savings.",
  visualDescription: "A currency gauge falling against a debt ledger.",
  locationDescription: "An abstract national treasury room.",
  actionDescription: "The gauge drops and a warning indicator activates.",
  cameraShot: "Close-up widening to a room-wide shot",
  cameraAngle: "High angle over the ledger",
  cameraMotion: "Downward move into a push",
  emotionalTone: "Sober",
  characterNames: [],
  propNames: [],
  continuityNotes: "",
  estimatedDurationMilliseconds: 12_000,
};

describe("parsePastedScenes", () => {
  it("accepts a single scene object", () => {
    const result = parsePastedScenes(JSON.stringify(complete));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scenes).toHaveLength(1);
  });

  it("accepts an array of scenes", () => {
    const result = parsePastedScenes(JSON.stringify([complete, complete]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scenes).toHaveLength(2);
  });

  it("accepts an object wrapping a scenes list", () => {
    const result = parsePastedScenes(JSON.stringify({ scenes: [complete] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scenes).toHaveLength(1);
  });

  it("keeps the pasted order, since scene order is the script's order", () => {
    const result = parsePastedScenes(
      JSON.stringify([
        { ...complete, narrationText: "First." },
        { ...complete, narrationText: "Second." },
        { ...complete, narrationText: "Third." },
      ]),
    );
    expect(
      result.ok && result.scenes.map((scene) => scene.narrationText),
    ).toEqual(["First.", "Second.", "Third."]);
  });
});

// The format a creator already has, rather than the spelling this application
// happens to use internally. Refusing these would mean rewriting every scene
// of a plan they have already written.
describe("the field names people actually write", () => {
  const theirShape = {
    narration: "Countries that borrow in foreign currencies face big risks.",
    visual_direction: "A currency gauge drops against a dollar debt ledger.",
    location: "Abstract national treasury room with currency charts.",
    action: "The domestic currency falls and the debt burden expands.",
    shot: "Close-up of a chart widening to a treasury-wide shot",
    angle: "High angle over the debt ledger",
    motion: "Downward chart movement then a rapid push",
    tone: "Sober",
  };

  it("reads a scene written in the snake_case shape", () => {
    const result = parsePastedScenes(JSON.stringify(theirShape));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.scenes[0]?.narrationText).toBe(theirShape.narration);
    expect(result.scenes[0]?.visualDescription).toBe(
      theirShape.visual_direction,
    );
    expect(result.scenes[0]?.cameraShot).toBe(theirShape.shot);
    expect(result.scenes[0]?.emotionalTone).toBe("Sober");
  });

  it("prefers the canonical name when a file carries both", () => {
    const result = parsePastedScenes(
      JSON.stringify({
        ...theirShape,
        narrationText: "The canonical one.",
        narration: "The alias one.",
      }),
    );
    expect(result.ok && result.scenes[0]?.narrationText).toBe(
      "The canonical one.",
    );
  });

  it("takes a comma-separated line where a list was expected", () => {
    const result = parsePastedScenes(
      JSON.stringify({ ...theirShape, characters: "Ana, Ben , ,Cleo" }),
    );
    expect(result.ok && result.scenes[0]?.characterNames).toEqual([
      "Ana",
      "Ben",
      "Cleo",
    ]);
  });
});

/** The same scene with no timing stated, which is how plans usually arrive. */
function omitDuration() {
  const copy: Record<string, unknown> = { ...complete };
  delete copy.estimatedDurationMilliseconds;
  return copy;
}

describe("duration", () => {
  it("uses a stated duration in milliseconds", () => {
    const result = parsePastedScenes(
      JSON.stringify({ ...complete, estimatedDurationMilliseconds: 7_500 }),
    );
    expect(result.ok && result.scenes[0]?.estimatedDurationMilliseconds).toBe(
      7_500,
    );
  });

  it("reads a duration written in seconds", () => {
    const withoutDuration = omitDuration();
    const result = parsePastedScenes(
      JSON.stringify({ ...withoutDuration, duration_seconds: 9 }),
    );
    expect(result.ok && result.scenes[0]?.estimatedDurationMilliseconds).toBe(
      9_000,
    );
  });

  // A plan written elsewhere rarely carries timings, and refusing it over a
  // field the recording will overrule anyway would be pedantry.
  it("estimates from the narration when none is stated", () => {
    const withoutDuration = omitDuration();
    const result = parsePastedScenes(JSON.stringify(withoutDuration));
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.scenes[0]?.estimatedDurationMilliseconds).toBe(
        estimateSceneDurationMilliseconds(complete.narrationText),
      );
  });

  it("never estimates a duration of zero for a very short line", () => {
    expect(estimateSceneDurationMilliseconds("Go.")).toBeGreaterThan(0);
    expect(estimateSceneDurationMilliseconds("")).toBeGreaterThan(0);
  });
});

describe("refusals", () => {
  it("explains malformed JSON instead of throwing", () => {
    const result = parsePastedScenes("{ not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.summary).toContain("valid JSON");
  });

  it("asks for something when given nothing", () => {
    expect(parsePastedScenes("   ").ok).toBe(false);
  });

  it("rejects a list that is not made of objects", () => {
    expect(parsePastedScenes(JSON.stringify(["a", "b"])).ok).toBe(false);
  });

  it("rejects an empty list rather than reporting nothing added", () => {
    const result = parsePastedScenes("[]");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.summary).toContain("no scenes");
  });

  // Somebody pasting twenty scenes wants the whole list of what to fix, not
  // one problem per attempt.
  it("reports every incomplete scene by position and field", () => {
    const result = parsePastedScenes(
      JSON.stringify([
        complete,
        { ...complete, narrationText: "" },
        { ...complete, cameraShot: "" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.scenePosition)).toEqual([2, 3]);
    expect(result.issues.map((issue) => issue.field)).toEqual([
      "narrationText",
      "cameraShot",
    ]);
  });

  // All or nothing: a half-imported plan is worse than a refused one, because
  // the creator has to work out which half landed.
  it("says plainly that nothing was added when anything is wrong", () => {
    const result = parsePastedScenes(
      JSON.stringify([complete, { ...complete, narrationText: "" }]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.summary).toContain("Nothing was added");
  });

  it("refuses a paste beyond the supported size", () => {
    const many = Array.from(
      { length: MAXIMUM_PASTED_SCENES + 1 },
      () => complete,
    );
    const result = parsePastedScenes(JSON.stringify(many));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.summary).toContain("limit");
  });
});

// The template is the thing the interface hands out, so it has to survive the
// round trip it invites: copy, edit, paste back.
describe("the published template", () => {
  it("is refused while still blank, naming what to fill in", () => {
    const result = parsePastedScenes(SCENE_TEMPLATE_JSON);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(
        result.issues.some((issue) => issue.field === "narrationText"),
      ).toBe(true);
  });

  it("is accepted once its required fields are filled", () => {
    const filled = {
      ...SCENE_TEMPLATE,
      narrationText: "A line.",
      visualDescription: "A picture.",
      locationDescription: "A place.",
      actionDescription: "A happening.",
      cameraShot: "Wide",
      cameraAngle: "Eye level",
      cameraMotion: "Static",
      emotionalTone: "Calm",
    };
    expect(parsePastedScenes(JSON.stringify(filled)).ok).toBe(true);
  });

  it("offers an array template that parses as a list", () => {
    const result = parsePastedScenes(SCENE_ARRAY_TEMPLATE_JSON);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.issues.some((issue) => issue.scenePosition === 2)).toBe(
        true,
      );
  });
});
