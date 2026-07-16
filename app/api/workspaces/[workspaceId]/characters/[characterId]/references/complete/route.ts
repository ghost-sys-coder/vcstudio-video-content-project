import { NextResponse } from "next/server";
import { saveCharacterReference } from "@/db/commands/character-commands";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { getCharacterEnvironment } from "@/lib/env/server";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { completeCharacterReferenceUploadSchema } from "@/lib/schemas/character";
import {
  deleteCharacterReferenceObject,
  inspectCharacterReference,
} from "@/lib/storage/character-reference-storage";
import { isCharacterReferenceObjectKey } from "@/lib/storage/object-key";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string; characterId: string }> },
) {
  let uncommittedObjectKey: string | null = null;
  try {
    const user = await requireAuthenticatedUser();
    const { workspaceId, characterId } = await context.params;
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId,
    });
    requireCapability(membership.role, "manageCharacters");
    const environment = getCharacterEnvironment();
    const parsed = completeCharacterReferenceUploadSchema({
      allowedTypes: environment.ALLOWED_IMAGE_MIME_TYPES,
      maximumBytes: environment.MAX_CHARACTER_REFERENCE_SIZE_BYTES,
    }).safeParse(await request.json());
    if (
      !parsed.success ||
      !isCharacterReferenceObjectKey({
        workspaceId,
        characterId,
        referenceType: parsed.data.type,
        objectKey: parsed.data.objectKey,
      })
    )
      return NextResponse.json(
        { error: "Invalid character reference." },
        { status: 400 },
      );
    uncommittedObjectKey = parsed.data.objectKey;
    const inspected = await inspectCharacterReference(parsed.data.objectKey);
    if (
      inspected.head.ContentLength !== parsed.data.sizeBytes ||
      inspected.head.ContentType !== parsed.data.contentType
    )
      throw new Error("REFERENCE_DECLARATION_MISMATCH");
    const saved = await saveCharacterReference({
      workspaceId,
      characterId,
      ...parsed.data,
      width: inspected.width,
      height: inspected.height,
      etag: inspected.head.ETag ?? null,
      userId: user.id,
    });
    uncommittedObjectKey = null;
    if (saved.previous)
      await deleteCharacterReferenceObject(saved.previous.objectKey).catch(
        () => undefined,
      );
    return NextResponse.json({ referenceId: saved.referenceId });
  } catch (error) {
    if (uncommittedObjectKey)
      await deleteCharacterReferenceObject(uncommittedObjectKey).catch(
        () => undefined,
      );
    const message =
      error instanceof Error && error.message === "REFERENCE_DIMENSIONS_INVALID"
        ? "The image dimensions are outside the allowed range."
        : "The reference could not be finalized.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
