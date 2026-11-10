import { task } from "@trigger.dev/sdk";
import {
  mcpGenerationTaskInput,
  runStandaloneMcpGeneration,
} from "@/lib/mcp/run-standalone-generation";
import { failStoppedMcpGeneration } from "@/lib/mcp/reconcile-generation-worker";
export const mcpAudioGenerationTask = task({
  id: "mcp-audio-generation",
  queue: { name: "audio-generation", concurrencyLimit: 2 },
  retry: { maxAttempts: 1 },
  maxDuration: 300,
  run: async (payload: unknown) =>
    runStandaloneMcpGeneration(mcpGenerationTaskInput.parse(payload)),
  onFailure: async ({ payload }) => {
    const input = mcpGenerationTaskInput.parse(payload);
    await failStoppedMcpGeneration(input.workspaceId, input.operationId);
  },
});
