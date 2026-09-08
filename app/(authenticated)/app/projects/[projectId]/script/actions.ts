"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  findProject,
  findProjectScriptDraft,
} from "@/db/repositories/projects.repository";
import { saveScriptDraft } from "@/db/commands/script-commands";
import { commitScriptVersion } from "@/db/commands/commit-script-version";
import { getProjectEnvironment } from "@/lib/env/server";
import {
  scriptDraftRequestSchema,
  type ScriptDraftResult,
} from "@/lib/scripts/script-draft-contract";

export async function persistScriptDraftAction(
  value: unknown,
): Promise<ScriptDraftResult> {
  const parsed = scriptDraftRequestSchema.safeParse(value);
  if (!parsed.success)
    return { status: "error", message: "Invalid script request." };
  const input = parsed.data;
  if (
    input.content.length > getProjectEnvironment().MAX_SCRIPT_CHARACTERS ||
    (input.approve && !input.content.trim())
  )
    return {
      status: "error",
      message:
        "Approval requires a non-empty script within the character limit.",
    };
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return {
        status: "error",
        message:
          "Sign in again to save. Your draft has been kept locally where storage is available.",
      };
    requireCapability(
      context.activeMembership.role,
      input.approve ? "approveScripts" : "mutateWorkspaceData",
    );
    const scope = {
      workspaceId: context.activeMembership.workspaceId,
      projectId: input.projectId,
    };
    const project = await findProject(scope);
    if (!project || project.status === "archived")
      return {
        status: "error",
        message: "This project is unavailable for editing.",
      };
    try {
      if (input.approve) {
        const version = await commitScriptVersion({
          ...scope,
          ...input,
          userId: context.user.id,
        });
        revalidatePath(`/app/projects/${input.projectId}/script`);
        revalidatePath(`/app/projects/${input.projectId}/scenes`);
        return {
          status: "saved",
          draft: { content: input.content, revision: version.revision },
          approvedVersionId: version.id,
        };
      }
      const draft = await saveScriptDraft({
        ...scope,
        ...input,
        userId: context.user.id,
      });
      // Autosave does not refresh the route on every keystroke burst.
      return {
        status: "saved",
        draft: { content: draft.content, revision: draft.revision },
      };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "SCRIPT_REVISION_CONFLICT"
      ) {
        const draft = await findProjectScriptDraft(scope);
        if (draft)
          return {
            status: "conflict",
            draft: { content: draft.content, revision: draft.revision },
          };
      }
      throw error;
    }
  } catch {
    return {
      status: "error",
      message:
        "The script could not be saved. Your changes are still here; retry when connected.",
    };
  }
}
