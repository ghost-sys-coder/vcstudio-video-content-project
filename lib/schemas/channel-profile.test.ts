import { describe, expect, it } from "vitest";
import {
  assignProjectChannelSchema,
  channelProfileInputSchema,
  createChannelProfileSlug,
} from "@/lib/schemas/channel-profile";

const VALID = {
  name: "Money Made Clear",
  platform: "youtube" as const,
  language: "en-US",
};

describe("channelProfileInputSchema", () => {
  it("accepts a minimal channel and applies defaults", () => {
    const parsed = channelProfileInputSchema.parse(VALID);
    expect(parsed.cadence).toBe("weekly");
    expect(parsed.timeZone).toBe("UTC");
    expect(parsed.defaultAspectRatio).toBeNull();
    expect(parsed.defaultMaximumBudgetCents).toBeNull();
    expect(parsed.externalAccountId).toBeNull();
  });

  it("accepts a real IANA zone and rejects an abbreviation", () => {
    expect(
      channelProfileInputSchema.parse({ ...VALID, timeZone: "Europe/London" })
        .timeZone,
    ).toBe("Europe/London");
    expect(
      channelProfileInputSchema.safeParse({ ...VALID, timeZone: "EST5EDT" })
        .success,
    ).toBe(true);
    expect(
      channelProfileInputSchema.safeParse({
        ...VALID,
        timeZone: "Notazone/Bad",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed language tag", () => {
    expect(
      channelProfileInputSchema.safeParse({ ...VALID, language: "english" })
        .success,
    ).toBe(false);
    expect(
      channelProfileInputSchema.safeParse({ ...VALID, language: "en" }).success,
    ).toBe(true);
  });

  it("rejects a negative default budget but allows zero and null", () => {
    expect(
      channelProfileInputSchema.safeParse({
        ...VALID,
        defaultMaximumBudgetCents: -1,
      }).success,
    ).toBe(false);
    expect(
      channelProfileInputSchema.parse({
        ...VALID,
        defaultMaximumBudgetCents: 0,
      }).defaultMaximumBudgetCents,
    ).toBe(0);
  });

  it("requires a name", () => {
    expect(
      channelProfileInputSchema.safeParse({ ...VALID, name: "   " }).success,
    ).toBe(false);
  });
});

describe("assignProjectChannelSchema", () => {
  it("accepts a channel id and an explicit clear", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      assignProjectChannelSchema.safeParse({
        projectId: id,
        channelProfileId: id,
      }).success,
    ).toBe(true);
    expect(
      assignProjectChannelSchema.safeParse({
        projectId: id,
        channelProfileId: "",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid channel", () => {
    expect(
      assignProjectChannelSchema.safeParse({
        projectId: "11111111-1111-4111-8111-111111111111",
        channelProfileId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});

describe("createChannelProfileSlug", () => {
  it("produces a stable url-safe handle", () => {
    expect(createChannelProfileSlug("Money Made Clear")).toBe(
      "money-made-clear",
    );
    expect(createChannelProfileSlug("Café Économie")).toBe("cafe-economie");
    expect(createChannelProfileSlug("  Shorts!!  ")).toBe("shorts");
  });

  it("falls back rather than returning an empty slug", () => {
    expect(createChannelProfileSlug("!!!")).toBe("channel");
    expect(createChannelProfileSlug("")).toBe("channel");
  });

  it("gives two differently named channels different slugs", () => {
    expect(createChannelProfileSlug("Brand A")).not.toBe(
      createChannelProfileSlug("Brand B"),
    );
  });
});
