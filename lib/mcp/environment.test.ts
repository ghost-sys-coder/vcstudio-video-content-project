import { describe, expect, it } from "vitest";
import { mcpEnvironmentSchema } from "@/lib/env/server-schema";
describe("MCP deployment flag", () => {
  it("defaults off and accepts only explicit boolean strings", () => {
    expect(mcpEnvironmentSchema.parse({}).ENABLE_MCP).toBe(false);
    expect(mcpEnvironmentSchema.parse({ ENABLE_MCP: "true" }).ENABLE_MCP).toBe(
      true,
    );
    expect(mcpEnvironmentSchema.safeParse({ ENABLE_MCP: "yes" }).success).toBe(
      false,
    );
  });
});
