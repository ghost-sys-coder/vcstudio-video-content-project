import { task } from "@trigger.dev/sdk";
import { z } from "zod";
import { findMarketingCompetitor } from "@/db/repositories/marketing-research.repository";
import { runMarketingResearch } from "@/lib/marketing/research/run-marketing-research";

const payloadSchema = z.object({
  workspaceId: z.uuid(),
  requestedByUserId: z.string().min(1),
  kind: z.enum(["company", "competitor"]),
  topic: z.string().trim().min(1).max(500),
  competitorId: z.uuid().optional(),
  requestNonce: z.uuid(),
});

export const marketingResearchTask = task({
  id: "marketing-research",
  queue: { name: "ai-text", concurrencyLimit: 2 },
  retry: { maxAttempts: 1 },
  maxDuration: 300,
  run: async (payload: z.infer<typeof payloadSchema>) => {
    const input = payloadSchema.parse(payload);
    const competitor = input.competitorId
      ? await findMarketingCompetitor({
          workspaceId: input.workspaceId,
          competitorId: input.competitorId,
        })
      : undefined;
    if (input.kind === "competitor" && !competitor)
      throw new Error("Competitor not found.");
    return runMarketingResearch({
      workspaceId: input.workspaceId,
      requestedByUserId: input.requestedByUserId,
      kind: input.kind,
      topic: input.topic,
      competitor,
      idempotencySubject: input.requestNonce,
    });
  },
});
