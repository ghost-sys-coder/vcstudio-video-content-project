import { NextResponse } from "next/server";
import {
  findWorkspaceLogo,
  saveWorkspaceLogo,
} from "@/db/repositories/storage-objects.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { completeWorkspaceLogoUploadSchema } from "@/lib/schemas/workspace-logo";
import { isWorkspaceLogoObjectKey } from "@/lib/storage/object-key";
import {
  deleteWorkspaceLogoObject,
  inspectWorkspaceLogo,
} from "@/lib/storage/workspace-logo-storage";

export async function POST(
  request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  let uncommittedObjectKey: string | null = null;
  try {
    const user = await requireAuthenticatedUser();
    const { workspaceId } = await context.params;
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId,
    });
    requireCapability(membership.role, "manageSettings");
    const parsed = completeWorkspaceLogoUploadSchema.safeParse(
      await request.json(),
    );
    if (
      !parsed.success ||
      !isWorkspaceLogoObjectKey({
        workspaceId,
        objectKey: parsed.data.objectKey,
      })
    ) {
      return NextResponse.json(
        { error: "Invalid workspace logo." },
        { status: 400 },
      );
    }
    uncommittedObjectKey = parsed.data.objectKey;
    const uploaded = await inspectWorkspaceLogo(parsed.data.objectKey);
    if (
      uploaded.ContentLength !== parsed.data.sizeBytes ||
      uploaded.ContentType !== parsed.data.contentType
    ) {
      await deleteWorkspaceLogoObject(parsed.data.objectKey);
      return NextResponse.json(
        { error: "The uploaded logo did not match its declaration." },
        { status: 400 },
      );
    }
    const previous = await findWorkspaceLogo(workspaceId);
    if (previous && previous.objectKey !== parsed.data.objectKey) {
      await deleteWorkspaceLogoObject(previous.objectKey);
    }
    await saveWorkspaceLogo({
      workspaceId,
      objectKey: parsed.data.objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
      etag: uploaded.ETag ?? null,
      createdByUserId: user.id,
    });
    uncommittedObjectKey = null;
    return NextResponse.json({ ok: true });
  } catch {
    if (uncommittedObjectKey) {
      await deleteWorkspaceLogoObject(uncommittedObjectKey).catch(
        () => undefined,
      );
    }
    return NextResponse.json(
      { error: "The logo could not be finalized." },
      { status: 500 },
    );
  }
}
