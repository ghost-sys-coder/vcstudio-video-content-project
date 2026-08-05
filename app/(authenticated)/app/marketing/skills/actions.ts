"use server";

import { revalidatePath } from "next/cache";
import {
  saveMarketingSkill,
  setMarketingSkillEnabled,
  softDeleteMarketingSkill,
} from "@/db/commands/marketing-skill-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  marketingSkillFormSchema,
  marketingSkillIdSchema,
} from "@/lib/schemas/marketing-skill";

export type MarketingSkillActionResult =
  { ok: true } | { ok: false; error: string };

async function requireSkillManager() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new WorkspacePermissionDeniedError();
  requireCapability(context.activeMembership.role, "manageMarketingSkills");
  return context;
}

export async function saveMarketingSkillAction(
  formData: FormData,
): Promise<MarketingSkillActionResult> {
  const parsed = marketingSkillFormSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That skill is not valid.",
    };
  try {
    const context = await requireSkillManager();
    await saveMarketingSkill({
      workspaceId: context.activeMembership.workspaceId,
      createdByUserId: context.user.id,
      skill: parsed.data,
    });
    revalidatePath("/app/marketing/skills");
    revalidatePath("/app/marketing/chat");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof WorkspacePermissionDeniedError
          ? "Only a workspace owner can manage custom skills."
          : "That skill could not be saved. Its slug may already be in use.",
    };
  }
}

export async function toggleMarketingSkillAction(
  formData: FormData,
): Promise<MarketingSkillActionResult> {
  const parsed = marketingSkillIdSchema.safeParse({
    skillId: formData.get("skillId"),
  });
  if (!parsed.success) return { ok: false, error: "That skill is invalid." };
  try {
    const context = await requireSkillManager();
    await setMarketingSkillEnabled({
      workspaceId: context.activeMembership.workspaceId,
      skillId: parsed.data.skillId,
      enabled: formData.get("enabled") === "true",
    });
    revalidatePath("/app/marketing/skills");
    revalidatePath("/app/marketing/chat");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof WorkspacePermissionDeniedError
          ? "Only a workspace owner can manage custom skills."
          : "That skill could not be updated.",
    };
  }
}

export async function deleteMarketingSkillAction(
  formData: FormData,
): Promise<MarketingSkillActionResult> {
  const parsed = marketingSkillIdSchema.safeParse({
    skillId: formData.get("skillId"),
  });
  if (!parsed.success) return { ok: false, error: "That skill is invalid." };
  try {
    const context = await requireSkillManager();
    const deleted = await softDeleteMarketingSkill({
      workspaceId: context.activeMembership.workspaceId,
      skillId: parsed.data.skillId,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "marketing_skill_deleted",
      targetType: "marketing_skill",
      targetId: deleted.id,
      metadata: { slug: deleted.slug },
    });
    revalidatePath("/app/marketing/skills");
    revalidatePath("/app/marketing/chat");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof WorkspacePermissionDeniedError
          ? "Only a workspace owner can manage custom skills."
          : "That skill could not be deleted.",
    };
  }
}
