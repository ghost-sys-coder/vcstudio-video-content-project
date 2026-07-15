import { NextResponse } from "next/server";
import {
  deleteWorkspaceLogoRecord,
  findWorkspaceLogo,
} from "@/db/repositories/storage-objects.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { deleteWorkspaceLogoObject } from "@/lib/storage/workspace-logo-storage";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { workspaceId } = await context.params;
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId,
    });
    requireCapability(membership.role, "manageSettings");
    const logo = await findWorkspaceLogo(workspaceId);
    if (logo) {
      await deleteWorkspaceLogoObject(logo.objectKey);
      await deleteWorkspaceLogoRecord(workspaceId);
    }
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "The logo could not be deleted." },
      { status: 500 },
    );
  }
}
