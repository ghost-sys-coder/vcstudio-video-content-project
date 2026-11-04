import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { getMcpEnvironment } from "@/lib/env/server";
import { runMcpImport } from "@/lib/mcp/import-service";
export const mcpMediaImportTask = schemaTask({
  id: "mcp-media-import",
  schema: z.object({ workspaceId: z.uuid(), operationId: z.uuid() }),
  queue: { name: "mcp-media-import", concurrencyLimit: 2 },
  maxDuration: 300,
  retry: { maxAttempts: 1 },
  run: async (input) => {
    if (!getMcpEnvironment().ENABLE_MCP) return { status: "disabled" };
    await runMcpImport(input.workspaceId, input.operationId);
    return { status: "complete" };
  },
});
