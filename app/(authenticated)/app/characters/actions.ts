"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveCharacter,
  createCharacter,
  updateCharacter,
} from "@/db/commands/character-commands";
import { findCharacter } from "@/db/repositories/characters.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getCharacterEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  characterFormSchema,
  characterIdSchema,
  updateCharacterSchema,
} from "@/lib/schemas/character";

export type CharacterActionState = { success: boolean; error: string | null };

async function requireCharacterManager() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("WORKSPACE_CONTEXT_MISSING");
  if (!getCharacterEnvironment().ENABLE_CHARACTER_LIBRARY)
    throw new Error("CHARACTER_LIBRARY_DISABLED");
  requireCapability(context.activeMembership.role, "manageCharacters");
  return context;
}

export async function createCharacterAction(
  formData: FormData,
): Promise<CharacterActionState> {
  const parsed = characterFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid character.",
    };
  let characterId: string;
  try {
    const context = await requireCharacterManager();
    const character = await createCharacter({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
    });
    characterId = character.id;
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error && error.message === "CHARACTER_SLUG_EXISTS"
          ? "A character with this name already exists in the workspace."
          : "The character could not be created.",
    };
  }
  revalidatePath("/app/characters");
  redirect(`/app/characters/${characterId}`);
}

export async function updateCharacterAction(
  formData: FormData,
): Promise<CharacterActionState> {
  const parsed = updateCharacterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid character.",
    };
  try {
    const context = await requireCharacterManager();
    await updateCharacter({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
    });
    revalidatePath("/app/characters");
    revalidatePath(`/app/characters/${parsed.data.characterId}`);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error && error.message === "CHARACTER_SLUG_EXISTS"
          ? "A character with this name already exists in the workspace."
          : "The character could not be updated.",
    };
  }
}

export async function archiveCharacterAction(
  formData: FormData,
): Promise<CharacterActionState> {
  const parsed = characterIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: "Invalid character." };
  try {
    const context = await requireCharacterManager();
    const character = await findCharacter({
      workspaceId: context.activeMembership.workspaceId,
      characterId: parsed.data.characterId,
    });
    if (!character) throw new Error("CHARACTER_NOT_FOUND");
    await archiveCharacter({
      workspaceId: context.activeMembership.workspaceId,
      characterId: character.id,
      userId: context.user.id,
    });
    revalidatePath("/app/characters");
  } catch {
    return { success: false, error: "The character could not be archived." };
  }
  redirect("/app/characters");
}
