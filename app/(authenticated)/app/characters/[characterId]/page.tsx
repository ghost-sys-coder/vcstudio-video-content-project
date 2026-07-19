import { notFound } from "next/navigation";
import { CharacterDetails } from "@/components/characters/CharacterDetails";
import {
  findCharacter,
  listCharacterReferences,
} from "@/db/repositories/characters.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { getCharacterEnvironment } from "@/lib/env/server";
import { loadCharacterPortraitView } from "@/lib/characters/character-reference-generation-view";

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  if (!getCharacterEnvironment().ENABLE_CHARACTER_LIBRARY) notFound();
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { characterId } = await params;
  const scope = {
    workspaceId: context.activeMembership.workspaceId,
    characterId,
  };
  const [character, references] = await Promise.all([
    findCharacter(scope),
    listCharacterReferences(scope),
  ]);
  if (!character) notFound();
  const canManage = can(context.activeMembership.role, "manageCharacters");
  const portrait =
    canManage && character.status !== "archived"
      ? await loadCharacterPortraitView({
          workspaceId: scope.workspaceId,
          character,
        })
      : null;
  return (
    <CharacterDetails
      canManage={canManage}
      character={character}
      references={references}
      portrait={portrait}
    />
  );
}
