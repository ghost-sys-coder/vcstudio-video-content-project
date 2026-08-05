import "server-only";
import { tool, type ToolSet } from "ai";
import { searchBrandKnowledge } from "@/lib/marketing/chat/search-brand-knowledge";
import { executeInlineMarketingSkill } from "@/lib/marketing/skills/execute-inline-skill";
import { executeDeferredMarketingSkill } from "@/lib/marketing/skills/execute-deferred-skill";
import { executeVideoDraftSkill } from "@/lib/marketing/skills/execute-video-draft-skill";
import type {
  MarketingSkillDefinition,
  SkillExecutionContext,
} from "@/lib/marketing/skills/skill-definition";

export function buildChatTools(input: {
  definitions: readonly MarketingSkillDefinition[];
  context: SkillExecutionContext;
}): ToolSet {
  return Object.fromEntries(
    input.definitions.map((definition) => [
      definition.key,
      tool({
        description: definition.description,
        inputSchema: definition.inputSchema,
        execute: async (values, options) => {
          const parsed = definition.inputSchema.parse(values) as Record<
            string,
            string | number
          >;
          if (definition.key === "create_video_draft")
            return executeVideoDraftSkill({
              definition,
              values: parsed,
              toolCallId: options.toolCallId,
              context: input.context,
            });
          if (definition.billing.kind === "free") {
            if (definition.key !== "search_brand_knowledge")
              throw new Error("MARKETING_FREE_SKILL_NOT_IMPLEMENTED");
            return searchBrandKnowledge({
              workspaceId: input.context.workspaceId,
              query: String(parsed.query),
            });
          }
          const execute =
            definition.execution === "deferred"
              ? executeDeferredMarketingSkill
              : executeInlineMarketingSkill;
          return execute({
            definition,
            values: parsed,
            toolCallId: options.toolCallId,
            context: input.context,
          });
        },
      }),
    ]),
  );
}

export function getBillableChatToolNames(
  definitions: readonly MarketingSkillDefinition[],
): string[] {
  return definitions
    .filter((definition) => definition.billing.kind !== "free")
    .map((definition) => definition.key);
}
