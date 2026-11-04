import { describe, expect, it } from "vitest";
import {
  formatMcpActivityDate,
  getMcpClientName,
} from "./settings-presentation";

describe("MCP connection display names", () => {
  it.each([
    ["https://chatgpt.com/connector/metadata.json", "ChatGPT"],
    ["https://claude.ai/client-metadata.json", "Claude"],
    [
      "https://claude.ai.attacker.example/metadata.json",
      "claude.ai.attacker.example",
    ],
    ["https://constructor/metadata.json", "constructor"],
    ["https://assistant.example/metadata.json", "assistant.example"],
    ["opaque-client-id", "AI application"],
    ["javascript:alert(1)", "AI application"],
  ])(
    "presents %s without confusing another client with a known provider",
    (input, expected) => {
      expect(getMcpClientName(input)).toBe(expected);
    },
  );
});
describe("MCP activity timestamps", () => {
  it("uses an explicit stable timezone across server and browser rendering", () => {
    expect(formatMcpActivityDate("2026-11-05T00:05:00+03:00")).toBe(
      "4 Nov 2026, 21:05 UTC",
    );
  });
  it("renders unavailable timestamps safely", () => {
    expect(formatMcpActivityDate("invalid")).toBe("Date unavailable");
  });
});
