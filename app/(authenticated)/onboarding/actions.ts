"use server";

import { cookies } from "next/headers";
import { createOwnedWorkspace } from "@/db/commands/create-workspace.command";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { ACTIVE_WORKSPACE_COOKIE } from "@/lib/auth/workspace-context";
import { createWorkspaceSchema } from "@/lib/schemas/workspace";

export type CreateWorkspaceActionState = {
  error: string | null;
  workspaceId: string | null;
};

export async function createWorkspaceAction(
  formData: FormData,
): Promise<CreateWorkspaceActionState> {
  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid workspace name.",
      workspaceId: null,
    };
  }

  try {
    const user = await requireAuthenticatedUser();
    const workspace = await createOwnedWorkspace({
      userId: user.id,
      name: parsed.data.name,
    });
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return { error: null, workspaceId: workspace.id };
  } catch (error) {
    console.error(
      "Workspace creation failed:",
      error instanceof Error ? error.message : "Unknown server error.",
    );
    return {
      error: "The workspace could not be created. Please try again.",
      workspaceId: null,
    };
  }
}
