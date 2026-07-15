"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import {
  ACTIVE_WORKSPACE_COOKIE,
  requireWorkspaceMembership,
} from "@/lib/auth/workspace-context";
import { selectWorkspaceSchema } from "@/lib/schemas/workspace";

export async function selectWorkspaceAction(formData: FormData): Promise<void> {
  const parsed = selectWorkspaceSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
  });

  if (!parsed.success) {
    redirect("/app/access-denied");
  }

  const user = await requireAuthenticatedUser();
  await requireWorkspaceMembership({
    userId: user.id,
    workspaceId: parsed.data.workspaceId,
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, parsed.data.workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/app");
}
