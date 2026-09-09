"use server";

import { revalidatePath } from "next/cache";
import {
  ProjectNotFoundError,
  setProjectPlannedRelease,
} from "@/db/commands/planned-release-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { setPlannedReleaseSchema } from "@/lib/schemas/production-queue";

export type PlannedReleaseActionState = {
  error: string | null;
  success: boolean;
};

/**
 * Records when a creator intends to release a project.
 *
 * This is editorial intent and nothing more. It cannot advance the project,
 * satisfy a review, or make an unrendered video look ready, because readiness
 * is derived from produced output and never reads this column.
 */
export async function setPlannedReleaseAction(
  formData: FormData,
): Promise<PlannedReleaseActionState> {
  const parsed = setPlannedReleaseSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid release date.",
      success: false,
    };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context) return { error: "Sign in to continue.", success: false };
    requireCapability(context.activeMembership.role, "mutateWorkspaceData");

    await setProjectPlannedRelease({
      workspaceId: context.activeMembership.workspaceId,
      projectId: parsed.data.projectId,
      plannedReleaseAt: parsed.data.plannedReleaseAt,
    });

    revalidatePath("/app/queue");
    revalidatePath(`/app/projects/${parsed.data.projectId}/settings`);
    return { error: null, success: true };
  } catch (error) {
    if (error instanceof ProjectNotFoundError)
      return { error: "Project not found in this workspace.", success: false };
    return { error: "The release date could not be saved.", success: false };
  }
}
