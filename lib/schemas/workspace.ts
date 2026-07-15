import { z } from "zod";

export const workspaceNameSchema = z
  .string()
  .trim()
  .min(2, "Workspace name must be at least 2 characters.")
  .max(80, "Workspace name must be 80 characters or fewer.");

export const createWorkspaceSchema = z.object({
  name: workspaceNameSchema,
});

export const selectWorkspaceSchema = z.object({
  workspaceId: z.uuid(),
});

export const updateWorkspaceProfileSchema = z.object({
  workspaceId: z.uuid(),
  name: workspaceNameSchema,
});
