"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import {
  ACTIVE_WORKSPACE_COOKIE,
  requireWorkspaceMembership,
} from "@/lib/auth/workspace-context";
import { updateUserThemePreference } from "@/db/commands/update-user-theme-preference.command";
import { selectWorkspaceSchema } from "@/lib/schemas/workspace";
import { updateThemePreferenceSchema } from "@/lib/schemas/user";
import {
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/theme/theme-cookie";

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

export async function updateThemePreferenceAction(
  formData: FormData,
): Promise<{ error: string | null; success: boolean }> {
  const parsed = updateThemePreferenceSchema.safeParse({
    theme: formData.get("theme"),
  });

  if (!parsed.success) {
    return { error: "Invalid theme preference.", success: false };
  }

  try {
    const user = await requireAuthenticatedUser();
    await updateUserThemePreference({
      userId: user.id,
      theme: parsed.data.theme,
    });

    const cookieStore = await cookies();
    cookieStore.set(THEME_COOKIE, parsed.data.theme, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: THEME_COOKIE_MAX_AGE_SECONDS,
    });

    revalidatePath("/app", "layout");
    return { error: null, success: true };
  } catch {
    return {
      error: "The theme preference could not be updated.",
      success: false,
    };
  }
}
