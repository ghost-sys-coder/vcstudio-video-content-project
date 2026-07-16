import { notFound } from "next/navigation";
import { CharacterDetails } from "@/components/characters/CharacterDetails";
import {
  findCharacter,
  listCharacterReferences,
} from "@/db/repositories/characters.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { getCharacterEnvironment } from "@/lib/env/server";

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
  return (
    <CharacterDetails
      canManage={can(context.activeMembership.role, "manageCharacters")}
      character={character}
      references={references}
    />
  );
}
