import { task, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import { runVideoGeneration } from "@/lib/video-generation/run-video-generation";
const payloadSchema = z
  .object({ workspaceId: z.uuid(), generationId: z.uuid() })
  .strict();
export const videoGenerationTask = task({
  id: "video-generation",
  queue: { name: "video-generation", concurrencyLimit: 1 },
  retry: { maxAttempts: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30000 },
  maxDuration: 1800,
  run: async (payload: z.infer<typeof payloadSchema>) =>
    runVideoGeneration(payloadSchema.parse(payload), async () => {
      await wait.for({ seconds: 10 });
    }),
});
