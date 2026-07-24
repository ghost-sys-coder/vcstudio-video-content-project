"use server";

import { cookies } from "next/headers";
import { acceptWorkspaceInvitation } from "@/db/commands/manage-workspace-members.command";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth/workspace-context";
import { acceptWorkspaceInvitationSchema } from "@/lib/schemas/workspace";

export type AcceptWorkspaceInvitationState = {
  error: string | null;
  workspaceId: string | null;
};

export async function acceptWorkspaceInvitationAction(
  formData: FormData,
): Promise<AcceptWorkspaceInvitationState> {
  const parsed = acceptWorkspaceInvitationSchema.safeParse({
    invitationId: formData.get("invitationId"),
  });
  if (!parsed.success) {
    return { error: "This invitation link is invalid.", workspaceId: null };
  }

  try {
    const user = await requireAuthenticatedUser();
    const workspaceId = await acceptWorkspaceInvitation({
      invitationId: parsed.data.invitationId,
      userId: user.id,
      userEmail: user.email,
    });

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return { error: null, workspaceId };
  } catch {
    return {
      error: "This invitation could not be accepted. Try again.",
      workspaceId: null,
    };
  }
}
