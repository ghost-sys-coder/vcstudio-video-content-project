import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { requestWorkspaceLogoUploadSchema } from "@/lib/schemas/workspace-logo";
import { createWorkspaceLogoObjectKey } from "@/lib/storage/object-key";
import { createWorkspaceLogoUploadUrl } from "@/lib/storage/workspace-logo-storage";

export async function POST(
  request: Request,
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
    const parsed = requestWorkspaceLogoUploadSchema.safeParse(
      await request.json(),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid logo." },
        { status: 400 },
      );
    }
    const objectKey = createWorkspaceLogoObjectKey({
      workspaceId,
      contentType: parsed.data.contentType,
    });
    const uploadUrl = await createWorkspaceLogoUploadUrl({
      objectKey,
      contentType: parsed.data.contentType,
      sizeBytes: parsed.data.sizeBytes,
    });
    return NextResponse.json({ objectKey, uploadUrl });
  } catch {
    return NextResponse.json(
      { error: "Logo upload is unavailable." },
      { status: 403 },
    );
  }
}
