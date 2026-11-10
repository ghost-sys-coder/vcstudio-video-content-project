import type { McpGenerationApprovalMode, McpScope } from "@studio/contracts";
import type { WorkspaceRole } from "@/db/schema";
import { McpError } from "./errors";
export function canConfigureAutonomousGeneration(role?: WorkspaceRole) {
  return role === "owner";
}
export function effectiveGenerationApprovalMode(input: {
  generationApprovalMode?: McpGenerationApprovalMode;
  role: WorkspaceRole;
}): McpGenerationApprovalMode {
  return canConfigureAutonomousGeneration(input.role) &&
    input.generationApprovalMode === "autonomous"
    ? "autonomous"
    : "manual";
}
export function assertGenerationApprovalGrant(input: {
  generationApprovalMode: McpGenerationApprovalMode;
  role: WorkspaceRole;
  scopes: McpScope[];
}) {
  if (
    input.generationApprovalMode === "autonomous" &&
    (!canConfigureAutonomousGeneration(input.role) ||
      !input.scopes.includes("vcstudio:generate"))
  )
    throw new McpError(
      "permission_denied",
      "Only a workspace owner with Generate media permission can enable autonomous generation.",
    );
}
