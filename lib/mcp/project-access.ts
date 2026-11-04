import "server-only";
import { findProject } from "@/db/repositories/projects.repository";
import {
  requireCapability,
  type WorkspaceCapability,
} from "@/lib/policies/workspace-policy";
import type { McpContext } from "./context";
import { requireMcp } from "./errors";
export async function requireMcpProject(
  context: McpContext,
  projectId: string,
  capability?: WorkspaceCapability,
) {
  if (capability) requireCapability(context.membership.role, capability);
  const project = await findProject({
    projectId,
    workspaceId: context.workspaceId,
  });
  requireMcp(
    project && (!capability || project.status !== "archived"),
    "not_found",
    "That project is unavailable in this workspace.",
  );
  return project;
}
