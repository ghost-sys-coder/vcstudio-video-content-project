import { CharacterLibrary } from "@/components/characters/CharacterLibrary";
import { listCharacters } from "@/db/repositories/characters.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { notFound } from "next/navigation";
import { getCharacterEnvironment } from "@/lib/env/server";

export default async function CharactersPage() {
  if (!getCharacterEnvironment().ENABLE_CHARACTER_LIBRARY) notFound();
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const characters = await listCharacters({
    workspaceId: context.activeMembership.workspaceId,
  });
  return (
    <CharacterLibrary
      canManage={can(context.activeMembership.role, "manageCharacters")}
      characters={characters}
    />
  );
}
