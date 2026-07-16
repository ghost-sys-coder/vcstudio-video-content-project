import { NextResponse } from "next/server";
import { deleteCharacterReference } from "@/db/commands/character-commands";
import { findCharacterReference } from "@/db/repositories/characters.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  createCharacterReferenceDownloadUrl,
  deleteCharacterReferenceObject,
} from "@/lib/storage/character-reference-storage";

type Params = { workspaceId: string; characterId: string; referenceId: string };

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const params = await context.params;
    await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: params.workspaceId,
    });
    const reference = await findCharacterReference(params);
    if (!reference) return new NextResponse(null, { status: 404 });
    return NextResponse.redirect(
      await createCharacterReferenceDownloadUrl(reference.objectKey),
    );
  } catch {
    return new NextResponse(null, { status: 403 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<Params> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const params = await context.params;
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: params.workspaceId,
    });
    requireCapability(membership.role, "manageCharacters");
    const reference = await findCharacterReference(params);
    if (!reference) return new NextResponse(null, { status: 404 });
    await deleteCharacterReferenceObject(reference.objectKey);
    await deleteCharacterReference({
      ...params,
      userId: user.id,
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "The reference could not be deleted." },
      { status: 400 },
    );
  }
}
