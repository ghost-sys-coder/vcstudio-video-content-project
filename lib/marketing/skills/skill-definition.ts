import type { z } from "zod";
import type { MarketingOperation, WorkspaceRole } from "@/db/schema";
import type { WorkspaceCapability } from "@/lib/policies/workspace-policy";
import type { RateLimitedOperation } from "@/lib/rate-limit/enforce-rate-limit";

export type SkillInputField = {
  key: string;
  label: string;
  type: "text" | "longtext" | "select" | "number" | "platform";
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  options?: readonly string[];
  minimum?: number;
  maximum?: number;
};

export type MarketingSkillDefinition = {
  key: string;
  executorKey?: string;
  userSkillId?: string;
  label: string;
  description: string;
  toolDescription?: string;
  group: "Content" | "Knowledge";
  capability: WorkspaceCapability;
  inputSchema: z.ZodObject;
  inputFields: readonly SkillInputField[];
  billing:
    | { kind: "free" }
    | { kind: "text"; expectedOutputTokens: number }
    | { kind: "image"; quality: "low" | "medium" | "high" };
  execution: "inline" | "deferred";
  operation: MarketingOperation | null;
  rateLimitOperation: RateLimitedOperation | null;
  requiresBrandProfile: boolean;
  promptVersion: string;
  skillVersion?: number;
  instructions: string;
  estimatedCostRangeCents: readonly [number, number];
};

export type MarketingSkillCatalogueItem = Pick<
  MarketingSkillDefinition,
  | "key"
  | "label"
  | "description"
  | "group"
  | "inputFields"
  | "estimatedCostRangeCents"
> & { requiresConfirmation: boolean };

export type SkillExecutionContext = {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  threadId: string;
  messageId: string;
  brandContext: string;
  brandContextFingerprint: string;
};
