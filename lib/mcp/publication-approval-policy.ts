import type { McpPublicationApprovalMode, McpScope } from "@studio/contracts";
import type { WorkspaceRole } from "@/db/schema";
import { McpError } from "./errors";

export function canConfigureAutonomousPublishing(role?: WorkspaceRole) {
  return role === "owner";
}

export function effectivePublicationApprovalMode(input: {
  publicationApprovalMode?: McpPublicationApprovalMode;
  role: WorkspaceRole;
}): McpPublicationApprovalMode {
  return canConfigureAutonomousPublishing(input.role) &&
    input.publicationApprovalMode === "autonomous"
    ? "autonomous"
    : "manual";
}

export function assertPublicationApprovalGrant(input: {
  publicationApprovalMode: McpPublicationApprovalMode;
  role: WorkspaceRole;
  scopes: McpScope[];
}) {
  if (
    input.publicationApprovalMode === "autonomous" &&
    (!canConfigureAutonomousPublishing(input.role) ||
      !input.scopes.includes("vcstudio:publish"))
  )
    throw new McpError(
      "permission_denied",
      "Only a workspace owner with Publish permission can enable autonomous publishing.",
    );
}
