import { describe, expect, it } from "vitest";

import {
  chatPartsToPlainText,
  isMarketingChatTextPart,
  MARKETING_CHAT_MAX_PARTS,
  MARKETING_CHAT_MAX_PART_CHARACTERS,
  marketingChatMessagePartSchema,
  sanitiseChatMessageParts,
} from "./marketing-chat-message";

describe("marketingChatMessagePartSchema", () => {
  it("accepts a text part", () => {
    expect(
      marketingChatMessagePartSchema.safeParse({ type: "text", text: "hello" })
        .success,
    ).toBe(true);
  });

  it("accepts a tool part", () => {
    expect(
      marketingChatMessagePartSchema.safeParse({
        type: "tool-search_brand_knowledge",
        toolCallId: "call-1",
        state: "output-available",
        input: { query: "pricing" },
        output: { results: [] },
      }).success,
    ).toBe(true);
  });

  it("rejects a tool part whose type is not a tool name", () => {
    expect(
      marketingChatMessagePartSchema.safeParse({
        type: "totally-not-a-tool",
        toolCallId: "call-1",
        state: "output-available",
      }).success,
    ).toBe(false);
  });

  it("rejects a text part over the part ceiling", () => {
    expect(
      marketingChatMessagePartSchema.safeParse({
        type: "text",
        text: "x".repeat(MARKETING_CHAT_MAX_PART_CHARACTERS + 1),
      }).success,
    ).toBe(false);
  });
});

describe("sanitiseChatMessageParts", () => {
  it("keeps valid parts and drops invalid ones", () => {
    // A stream that produced one malformed part still produced an answer the
    // user watched arrive; discarding the whole turn would lose paid work.
    const kept = sanitiseChatMessageParts([
      { type: "text", text: "kept" },
      { type: "text" },
      { nonsense: true },
      { type: "step-start" },
    ]);
    expect(kept).toEqual([
      { type: "text", text: "kept" },
      { type: "step-start" },
    ]);
  });

  it("returns an empty array for a non-array", () => {
    expect(sanitiseChatMessageParts("not an array")).toEqual([]);
    expect(sanitiseChatMessageParts(null)).toEqual([]);
  });

  it("stops at the part ceiling", () => {
    const parts = Array.from({ length: MARKETING_CHAT_MAX_PARTS + 20 }, () => ({
      type: "text",
      text: "x",
    }));
    expect(sanitiseChatMessageParts(parts)).toHaveLength(
      MARKETING_CHAT_MAX_PARTS,
    );
  });
});

describe("chatPartsToPlainText", () => {
  it("joins only the text parts", () => {
    expect(
      chatPartsToPlainText([
        { type: "text", text: "first" },
        {
          type: "tool-search_brand_knowledge",
          toolCallId: "call-1",
          state: "output-available",
        },
        { type: "text", text: "second" },
      ]),
    ).toBe("first\n\nsecond");
  });

  it("is empty when there is no text", () => {
    expect(chatPartsToPlainText([{ type: "step-start" }])).toBe("");
  });
});

describe("isMarketingChatTextPart", () => {
  it("does not mistake a tool part for text", () => {
    expect(
      isMarketingChatTextPart({
        type: "tool-search_brand_knowledge",
        toolCallId: "call-1",
        state: "output-available",
      }),
    ).toBe(false);
  });
});
