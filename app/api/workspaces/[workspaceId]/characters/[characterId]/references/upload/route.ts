import { NextResponse } from "next/server";
import { findCharacter } from "@/db/repositories/characters.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { getCharacterEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { createCharacterReferenceUploadSchema } from "@/lib/schemas/character";
import { createCharacterReferenceUploadUrl } from "@/lib/storage/character-reference-storage";
import { createCharacterReferenceObjectKey } from "@/lib/storage/object-key";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; characterId: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { workspaceId, characterId } = await context.params;
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId,
    });
    requireCapability(membership.role, "manageCharacters");
    const character = await findCharacter({ workspaceId, characterId });
    if (!character || character.status === "archived")
      throw new Error("CHARACTER_UNAVAILABLE");
    const environment = getCharacterEnvironment();
    const parsed = createCharacterReferenceUploadSchema({
      allowedTypes: environment.ALLOWED_IMAGE_MIME_TYPES,
      maximumBytes: environment.MAX_CHARACTER_REFERENCE_SIZE_BYTES,
    }).safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid reference." },
        { status: 400 },
      );
    const objectKey = createCharacterReferenceObjectKey({
      workspaceId,
      characterId,
      referenceType: parsed.data.type,
      contentType: parsed.data.contentType,
    });
    const uploadUrl = await createCharacterReferenceUploadUrl({
      objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json({ objectKey, uploadUrl });
  } catch {
    return NextResponse.json(
      { error: "Reference upload is unavailable." },
      { status: 403 },
    );
  }
}
