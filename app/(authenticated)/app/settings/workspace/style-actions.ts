"use server";

import { revalidatePath } from "next/cache";
import {
  StylePresetError,
  archiveStylePreset,
  createStylePresetWithVersion,
  restoreStylePreset,
  setDefaultStylePreset,
} from "@/db/commands/style-preset-commands";
import { createStylePresetVersion } from "@/db/commands/scene-image-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";
import { findStylePresetTemplate } from "@/lib/domain/style-preset-templates";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  addStylePresetFromTemplateSchema,
  archiveStylePresetSchema,
  createStylePresetSchema,
  readStylePresetBodyForm,
  updateStylePresetSchema,
} from "@/lib/schemas/style-preset";

export type StylePresetActionState = {
  error: string | null;
  success: boolean;
};

const SETTINGS_PATH = "/app/settings/workspace";

/**
 * Resolves the caller and checks the capability in one place.
 *
 * Every action below is a workspace-scoped write, and the workspace is taken
 * from the authenticated session rather than from the form, so a submitted
 * workspace id can never widen what the caller reaches.
 */
async function requireStyleManager() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new WorkspacePermissionDeniedError();
  requireCapability(context.activeMembership.role, "manageStylePresets");
  return {
    workspaceId: context.activeMembership.workspaceId,
    userId: context.user.id,
  };
}

function toActionState(error: unknown): StylePresetActionState {
  if (error instanceof WorkspacePermissionDeniedError)
    return {
      error: "You do not have permission to manage styles.",
      success: false,
    };
  if (error instanceof StylePresetError)
    return { error: error.message, success: false };
  if (error instanceof Error && error.message === "STYLE_PRESET_NOT_FOUND")
    return { error: "That style could not be found.", success: false };
  if (
    error instanceof Error &&
    error.message === "STYLE_PRESET_VERSION_CONFLICT"
  )
    return {
      error:
        "Somebody else edited this style while you were working. Reload to see their version before saving again.",
      success: false,
    };
  console.error("Style preset action failed", {
    message: error instanceof Error ? error.message : "unknown error",
  });
  return { error: "That style could not be saved.", success: false };
}

export async function createStylePresetAction(
  formData: FormData,
): Promise<StylePresetActionState> {
  const parsed = createStylePresetSchema.safeParse(
    readStylePresetBodyForm(formData),
  );
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "That style is not valid.",
      success: false,
    };

  try {
    const { workspaceId, userId } = await requireStyleManager();
    const created = await createStylePresetWithVersion({
      workspaceId,
      userId,
      ...parsed.data,
    });
    await recordAuditEvent({
      workspaceId,
      actorUserId: userId,
      action: "style_preset_created",
      targetType: "style_preset",
      targetId: created.id,
      metadata: { name: parsed.data.name },
    });
    revalidatePath(SETTINGS_PATH);
    return { error: null, success: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function addStylePresetFromTemplateAction(
  formData: FormData,
): Promise<StylePresetActionState> {
  const parsed = addStylePresetFromTemplateSchema.safeParse({
    templateKey: formData.get("templateKey"),
  });
  if (!parsed.success)
    return { error: "That template is not valid.", success: false };

  const chosen = findStylePresetTemplate(parsed.data.templateKey);
  if (!chosen)
    return { error: "That template is no longer available.", success: false };

  try {
    const { workspaceId, userId } = await requireStyleManager();
    const created = await createStylePresetWithVersion({
      workspaceId,
      userId,
      name: chosen.name,
      description: chosen.description,
      positivePrompt: chosen.positivePrompt,
      negativePrompt: chosen.negativePrompt,
      defaultAspectRatio: chosen.defaultAspectRatio,
    });
    await recordAuditEvent({
      workspaceId,
      actorUserId: userId,
      action: "style_preset_created",
      targetType: "style_preset",
      targetId: created.id,
      metadata: { name: chosen.name, template: chosen.key },
    });
    revalidatePath(SETTINGS_PATH);
    return { error: null, success: true };
  } catch (error) {
    return toActionState(error);
  }
}

/**
 * Saves an edit by appending a version rather than overwriting the current one.
 *
 * This is what keeps earlier images explainable: every generation stores the
 * style version it used, so the exact wording that produced a finished video
 * stays readable after the style is changed.
 */
export async function updateStylePresetAction(
  formData: FormData,
): Promise<StylePresetActionState> {
  const parsed = updateStylePresetSchema.safeParse({
    ...readStylePresetBodyForm(formData),
    stylePresetId: formData.get("stylePresetId"),
    expectedCurrentVersion: formData.get("expectedCurrentVersion"),
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "That style is not valid.",
      success: false,
    };

  try {
    const { workspaceId, userId } = await requireStyleManager();
    await createStylePresetVersion({
      workspaceId,
      userId,
      stylePresetId: parsed.data.stylePresetId,
      expectedCurrentVersion: parsed.data.expectedCurrentVersion,
      name: parsed.data.name,
      description: parsed.data.description,
      positivePrompt: parsed.data.positivePrompt,
      negativePrompt: parsed.data.negativePrompt,
      defaultAspectRatio: parsed.data.defaultAspectRatio,
    });
    await recordAuditEvent({
      workspaceId,
      actorUserId: userId,
      action: "style_preset_updated",
      targetType: "style_preset",
      targetId: parsed.data.stylePresetId,
      metadata: { name: parsed.data.name },
    });
    revalidatePath(SETTINGS_PATH);
    return { error: null, success: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function setDefaultStylePresetAction(
  formData: FormData,
): Promise<StylePresetActionState> {
  const parsed = archiveStylePresetSchema.safeParse({
    stylePresetId: formData.get("stylePresetId"),
  });
  if (!parsed.success)
    return { error: "That style is not valid.", success: false };

  try {
    const { workspaceId, userId } = await requireStyleManager();
    await setDefaultStylePreset({
      workspaceId,
      stylePresetId: parsed.data.stylePresetId,
    });
    await recordAuditEvent({
      workspaceId,
      actorUserId: userId,
      action: "style_preset_updated",
      targetType: "style_preset",
      targetId: parsed.data.stylePresetId,
      metadata: { madeDefault: true },
    });
    revalidatePath(SETTINGS_PATH);
    return { error: null, success: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function archiveStylePresetAction(
  formData: FormData,
): Promise<StylePresetActionState> {
  const parsed = archiveStylePresetSchema.safeParse({
    stylePresetId: formData.get("stylePresetId"),
  });
  if (!parsed.success)
    return { error: "That style is not valid.", success: false };

  try {
    const { workspaceId, userId } = await requireStyleManager();
    await archiveStylePreset({
      workspaceId,
      stylePresetId: parsed.data.stylePresetId,
    });
    await recordAuditEvent({
      workspaceId,
      actorUserId: userId,
      action: "style_preset_archived",
      targetType: "style_preset",
      targetId: parsed.data.stylePresetId,
    });
    revalidatePath(SETTINGS_PATH);
    return { error: null, success: true };
  } catch (error) {
    return toActionState(error);
  }
}

export async function restoreStylePresetAction(
  formData: FormData,
): Promise<StylePresetActionState> {
  const parsed = archiveStylePresetSchema.safeParse({
    stylePresetId: formData.get("stylePresetId"),
  });
  if (!parsed.success)
    return { error: "That style is not valid.", success: false };

  try {
    const { workspaceId, userId } = await requireStyleManager();
    await restoreStylePreset({
      workspaceId,
      stylePresetId: parsed.data.stylePresetId,
    });
    // Recorded as an update rather than left untracked: bringing a style back
    // changes what the workspace can generate, and the archive that preceded
    // it is already in the trail. A one-sided trail reads as if it never
    // returned.
    await recordAuditEvent({
      workspaceId,
      actorUserId: userId,
      action: "style_preset_updated",
      targetType: "style_preset",
      targetId: parsed.data.stylePresetId,
      metadata: { restored: true },
    });
    revalidatePath(SETTINGS_PATH);
    return { error: null, success: true };
  } catch (error) {
    return toActionState(error);
  }
}
