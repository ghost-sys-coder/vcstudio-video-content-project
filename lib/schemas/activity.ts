import { z } from "zod";

export const activityCategories = [
  "review_required",
  "completed",
  "failed",
  "partially_failed",
  "integration_attention",
  "budget_or_cap_refusal",
  "scheduled_action_skipped",
] as const;

export const activityCategorySchema = z.enum(activityCategories);
export type ActivityCategory = z.infer<typeof activityCategorySchema>;

export const activityFilterSchema = z.object({
  category: activityCategorySchema.optional(),
  state: z.enum(["all", "unread", "acknowledged"]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export const acknowledgeActivitySchema = z.object({
  workspaceId: z.string().uuid(),
  activityKey: z
    .string()
    .regex(
      /^(scene-image|scene-audio|render|social-target|marketing-content|marketing-schedule|google-business):[0-9a-f-]{36}$/,
      "Invalid activity identifier.",
    ),
});
