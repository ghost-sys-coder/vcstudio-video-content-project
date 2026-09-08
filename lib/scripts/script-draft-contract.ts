import { z } from "zod";

export const scriptDraftRequestSchema = z.object({
  projectId: z.uuid(),
  content: z.string(),
  revision: z.number().int().nonnegative(),
  approve: z.boolean().default(false),
});
export interface ScriptDraftSnapshot {
  content: string;
  revision: number;
}
export type ScriptDraftResult =
  | { status: "saved"; draft: ScriptDraftSnapshot; approvedVersionId?: string }
  | { status: "conflict"; draft: ScriptDraftSnapshot }
  | { status: "error"; message: string };
