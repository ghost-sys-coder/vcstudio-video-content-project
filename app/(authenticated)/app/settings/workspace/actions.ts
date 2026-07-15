"use server";

import { revalidatePath } from "next/cache";
import { updateWorkspaceName } from "@/db/commands/update-workspace.command";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { updateWorkspaceProfileSchema } from "@/lib/schemas/workspace";

export type UpdateWorkspaceProfileState = {
  error: string | null;
  success: boolean;
};

export async function updateWorkspaceProfileAction(
  formData: FormData,
): Promise<UpdateWorkspaceProfileState> {
  const parsed = updateWorkspaceProfileSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid workspace profile.",
      success: false,
    };
  }

  try {
    const user = await requireAuthenticatedUser();
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    });
    requireCapability(membership.role, "manageSettings");
    await updateWorkspaceName(parsed.data);
    revalidatePath("/app", "layout");
    return { error: null, success: true };
  } catch {
    return {
      error: "The workspace profile could not be updated.",
      success: false,
    };
  }
}
