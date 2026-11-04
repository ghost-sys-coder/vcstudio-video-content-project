import { describe, expect, it } from "vitest";
import { assertMcpTokenResource } from "./token-resource";
const resource = "https://studio.example/mcp";
const token = (claims: unknown) =>
  `verified.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.signature`;
describe("verified OAuth resource binding", () => {
  it("accepts the canonical resource in a string or audience list", () => {
    expect(() =>
      assertMcpTokenResource(token({ aud: resource }), resource),
    ).not.toThrow();
    expect(() =>
      assertMcpTokenResource(token({ aud: ["other", resource] }), resource),
    ).not.toThrow();
  });
  for (const value of [
    token({ aud: "a-client-id" }),
    token({ aud: resource + "/" }),
    token({}),
    "opaque-token",
    "malformed.jwt.value",
  ])
    it("rejects an unbound access token", () =>
      expect(() => assertMcpTokenResource(value, resource)).toThrow(
        "issued for",
      ));
});
