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

export const workspaceRoleSchema = z.enum(["owner", "editor", "viewer"]);

export const inviteWorkspaceMemberSchema = z.object({
  workspaceId: z.uuid(),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  role: workspaceRoleSchema,
});

export const revokeWorkspaceInvitationSchema = z.object({
  workspaceId: z.uuid(),
  invitationId: z.uuid(),
});

export const updateWorkspaceMemberRoleSchema = z.object({
  workspaceId: z.uuid(),
  membershipId: z.uuid(),
  role: workspaceRoleSchema,
});

export const removeWorkspaceMemberSchema = z.object({
  workspaceId: z.uuid(),
  membershipId: z.uuid(),
});

export const acceptWorkspaceInvitationSchema = z.object({
  invitationId: z.uuid(),
});
