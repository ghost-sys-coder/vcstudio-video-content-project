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
  generateCharacterReferenceSchema,
  updateCharacterSchema,
} from "@/lib/schemas/character";
import { startCharacterReferenceGeneration } from "@/lib/characters/start-character-reference-generation";
import {
  CharacterAnimationCheckError,
  loadCharacterAnimationCheck,
} from "@/lib/characters/character-animation-check";
import type { CharacterAnimationCheckView } from "@/lib/characters/animation-check-view";
import { BudgetExceededError } from "@/lib/domain/errors";

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

export async function generateCharacterReferenceAction(
  formData: FormData,
): Promise<CharacterActionState> {
  const parsed = generateCharacterReferenceSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "Invalid portrait request." };
  try {
    const context = await requireCharacterManager();
    await startCharacterReferenceGeneration({
      workspaceId: context.activeMembership.workspaceId,
      requestedByUserId: context.user.id,
      characterId: parsed.data.characterId,
      referenceType: parsed.data.referenceType,
      requestNonce: parsed.data.requestNonce,
    });
    revalidatePath(`/app/characters/${parsed.data.characterId}`);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof BudgetExceededError)
      return {
        success: false,
        error:
          error.scope === "workspace_daily"
            ? "This portrait would exceed the workspace daily budget."
            : "This portrait would exceed the workspace monthly budget.",
      };
    return { success: false, error: "The portrait could not be started." };
  }
}

export type CharacterAnimationCheckState =
  | { success: true; view: CharacterAnimationCheckView; error: null }
  | { success: false; view: null; error: string };

/**
 * Inspects what is actually stored for this character's four pose stills, so an
 * animated project is only set up on a character that will really animate.
 *
 * Read-only, but it reads objects out of storage and decodes them, so it stays
 * behind the same manage-characters gate as the rest of this file rather than
 * being open to viewers.
 */
export async function runCharacterAnimationCheckAction(
  formData: FormData,
): Promise<CharacterAnimationCheckState> {
  const parsed = characterIdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { success: false, view: null, error: "Invalid character." };
  try {
    const context = await requireCharacterManager();
    const character = await findCharacter({
      workspaceId: context.activeMembership.workspaceId,
      characterId: parsed.data.characterId,
    });
    if (!character) throw new Error("CHARACTER_NOT_FOUND");
    const view = await loadCharacterAnimationCheck({
      workspaceId: context.activeMembership.workspaceId,
      character,
    });
    return { success: true, view, error: null };
  } catch (error) {
    return {
      success: false,
      view: null,
      error:
        error instanceof CharacterAnimationCheckError
          ? "A pose image could not be read from storage. Try regenerating the poses."
          : "The animation check could not be run.",
    };
  }
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
