import "server-only";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { findMcpOperation } from "@/db/repositories/mcp.repository";
import { requireMcpEnabled, authorizeMcpBrowser } from "./context";
import { requireMcp } from "./errors";
export async function loadBrowserMcpOperation(
  operationId: string,
  workspaceId: string,
) {
  requireMcpEnabled();
  z.uuid().parse(operationId);
  z.uuid().parse(workspaceId);
  const user = await requireAuthenticatedUser();
  const operation = await findMcpOperation({
    operationId,
    workspaceId,
    userId: user.id,
  });
  requireMcp(operation, "not_found", "That operation is unavailable.");
  const scope =
    operation.kind === "publish_post"
      ? "vcstudio:publish"
      : operation.kind === "import_asset" || operation.kind === "assign_image"
        ? "vcstudio:media"
        : "vcstudio:read";
  const context = await authorizeMcpBrowser(
    user.id,
    operation.connectionId,
    workspaceId,
    scope,
  );
  return { context, operation };
}
