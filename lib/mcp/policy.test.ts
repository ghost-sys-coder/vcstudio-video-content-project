import { describe, expect, it } from "vitest";
import { assertMcpAccess, roleAllowsScope } from "./policy";
import { MCP_SCOPES } from "@studio/contracts";
describe("MCP authorization intersection", () => {
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
