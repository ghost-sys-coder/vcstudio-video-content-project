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
