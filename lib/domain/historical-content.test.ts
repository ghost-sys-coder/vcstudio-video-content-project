import { describe, expect, it } from "vitest";
import { isHistoricalContent } from "@/lib/domain/historical-content";

describe("isHistoricalContent", () => {
  it("detects a historical niche", () => {
    expect(isHistoricalContent({ niche: "History in short stories" })).toBe(
      true,
    );
    expect(isHistoricalContent({ niche: "Ancient Rome history" })).toBe(true);
  });

  it("detects a historical topic when niche is blank", () => {
    expect(
      isHistoricalContent({
        niche: "",
        topic: "The history of the Roman Empire",
      }),
    ).toBe(true);
  });

  it("detects a historical hook angle", () => {
    expect(
      isHistoricalContent({
        niche: "",
        topic: "",
        hookAngle: "open with a historic assassination",
      }),
    ).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isHistoricalContent({ niche: "HISTORY" })).toBe(true);
  });

  it("returns false for unrelated content", () => {
    expect(
      isHistoricalContent({
        niche: "Personal finance & money habits",
        topic: "Why budgets fail",
        hookAngle: "you are not bad with money",
      }),
    ).toBe(false);
  });

  it("returns false when nothing is provided", () => {
    expect(isHistoricalContent({})).toBe(false);
  });
});
