import { describe, expect, it } from "vitest";
import {
  captionStyleSchema,
  coerceCaptionStyle,
  DEFAULT_CAPTION_STYLE,
  parseCaptionStyle,
} from "@/lib/subtitles/caption-style";

describe("caption style validation", () => {
  it("accepts a well-formed style and lowercases hex colors", () => {
    const result = captionStyleSchema.parse({
      ...DEFAULT_CAPTION_STYLE,
      primaryColor: "#FFAA00",
    });
    expect(result.primaryColor).toBe("#ffaa00");
  });

  it("rejects malformed hex colors", () => {
    expect(
      captionStyleSchema.safeParse({
        ...DEFAULT_CAPTION_STYLE,
        primaryColor: "white",
      }).success,
    ).toBe(false);
  });

  it("rejects an out-of-range font size", () => {
    expect(
      captionStyleSchema.safeParse({
        ...DEFAULT_CAPTION_STYLE,
        fontSizePercent: 40,
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid position", () => {
    expect(
      captionStyleSchema.safeParse({
        ...DEFAULT_CAPTION_STYLE,
        position: "left",
      }).success,
    ).toBe(false);
  });

  it("fills missing fields from defaults when parsing a partial style", () => {
    const result = parseCaptionStyle({ primaryColor: "#123456" });
    expect(result.primaryColor).toBe("#123456");
    expect(result.fontFamily).toBe(DEFAULT_CAPTION_STYLE.fontFamily);
    expect(result.position).toBe(DEFAULT_CAPTION_STYLE.position);
  });

  it("coerces invalid stored values back to defaults without throwing", () => {
    expect(coerceCaptionStyle("not an object")).toEqual(DEFAULT_CAPTION_STYLE);
    expect(coerceCaptionStyle({ fontSizePercent: 999 })).toEqual(
      DEFAULT_CAPTION_STYLE,
    );
  });
});

describe("styles stored before placement and motion existed", () => {
  it("keeps rendering exactly as they did", () => {
    // Every existing project has a caption style with none of the new fields.
    // They must come back centred with a hard cut, which is what they have
    // always looked like, rather than silently gaining an animation.
    const legacy = {
      fontFamily: "Inter",
      fontSizePercent: 4.5,
      primaryColor: "#ffffff",
      outlineColor: "#000000",
      backgroundColor: "#000000",
      backgroundOpacityPercent: 55,
      position: "bottom",
      bold: true,
      uppercase: false,
      maxLineCharacters: 42,
      safeMarginPercent: 8,
    };
    const coerced = coerceCaptionStyle(legacy);
    expect(coerced.horizontalPosition).toBe("center");
    expect(coerced.entranceEffect).toBe("none");
    expect(coerced.position).toBe("bottom");
  });

  it("accepts the new placements and effects", () => {
    const parsed = parseCaptionStyle({
      horizontalPosition: "right",
      entranceEffect: "slide-fade",
      entranceDirection: "left",
      entranceDurationMilliseconds: 400,
      exitMatchesEntrance: false,
    });
    expect(parsed.horizontalPosition).toBe("right");
    expect(parsed.entranceEffect).toBe("slide-fade");
    expect(parsed.entranceDirection).toBe("left");
    expect(parsed.entranceDurationMilliseconds).toBe(400);
    expect(parsed.exitMatchesEntrance).toBe(false);
  });

  it("refuses an unbounded entrance duration and an unknown placement", () => {
    expect(
      captionStyleSchema.safeParse({
        ...DEFAULT_CAPTION_STYLE,
        entranceDurationMilliseconds: 60_000,
      }).success,
    ).toBe(false);
    expect(
      captionStyleSchema.safeParse({
        ...DEFAULT_CAPTION_STYLE,
        horizontalPosition: "diagonal",
      }).success,
    ).toBe(false);
  });
});
