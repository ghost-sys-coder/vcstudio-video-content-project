import { describe, expect, it } from "vitest";
import { assertMcpAccess, roleAllowsScope } from "./policy";
import { MCP_SCOPES } from "@studio/contracts";
import { McpScopeError } from "./errors";
describe("MCP authorization intersection", () => {
  it("requests incremental OAuth consent without dropping existing known permissions", () => {
    expect(() =>
      assertMcpAccess({
        role: "owner",
        tokenScopes: ["vcstudio:read", 'unrelated\"\r\nInjected: value'],
        grantedScopes: [...MCP_SCOPES],
        scope: "vcstudio:generate",
        revoked: false,
      }),
    ).toThrow(McpScopeError);
    try {
      assertMcpAccess({
        role: "owner",
        tokenScopes: ["vcstudio:read", 'unrelated\"\r\nInjected: value'],
        grantedScopes: [...MCP_SCOPES],
        scope: "vcstudio:generate",
        revoked: false,
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: "insufficient_scope",
        scope: "vcstudio:generate",
        scopes: ["vcstudio:read", "vcstudio:generate"],
      });
    }
  });
  it("never suggests OAuth as a remedy for missing grants, revocation or a denied role", () => {
    for (const changed of [
      { grantedScopes: [] },
      { revoked: true },
      { role: "viewer" as const },
    ]) {
      try {
        assertMcpAccess({
          role: "owner",
          tokenScopes: [],
          grantedScopes: [...MCP_SCOPES],
          scope: "vcstudio:generate",
          revoked: false,
          ...changed,
        });
        throw new Error("Expected application denial");
      } catch (error) {
        expect(error).not.toBeInstanceOf(McpScopeError);
        expect(error).toMatchObject({ code: "permission_denied" });
      }
    }
  });
  for (const role of ["owner", "editor", "viewer"] as const)
    for (const scope of MCP_SCOPES) {
      it(`${role}: ${scope}`, () => {
        const call = () =>
          assertMcpAccess({
            role,
            scope,
            tokenScopes: [...MCP_SCOPES],
            grantedScopes: [...MCP_SCOPES],
            revoked: false,
          });
        if (role === "viewer" && scope !== "vcstudio:read")
          expect(call).toThrow();
        else expect(call).not.toThrow();
        expect(roleAllowsScope(role, scope)).toBe(
          role !== "viewer" || scope === "vcstudio:read",
        );
      });
    }
  it("does not let owners bypass OAuth scopes, application grants or revocation", () => {
    for (const input of [
      { tokenScopes: [], grantedScopes: [...MCP_SCOPES], revoked: false },
      { tokenScopes: [...MCP_SCOPES], grantedScopes: [], revoked: false },
      {
        tokenScopes: [...MCP_SCOPES],
        grantedScopes: [...MCP_SCOPES],
        revoked: true,
      },
    ])
      expect(() =>
        assertMcpAccess({ ...input, role: "owner", scope: "vcstudio:publish" }),
      ).toThrow("permission");
  });
});
