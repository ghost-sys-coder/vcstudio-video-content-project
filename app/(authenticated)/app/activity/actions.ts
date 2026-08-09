"use server";

import { revalidatePath } from "next/cache";
import { acknowledgeWorkspaceActivity } from "@/db/repositories/activity.repository";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import { acknowledgeActivitySchema } from "@/lib/schemas/activity";

export async function acknowledgeActivityAction(formData: FormData) {
  const parsed = acknowledgeActivitySchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    activityKey: formData.get("activityKey"),
  });
  if (!parsed.success) return;
  const user = await requireAuthenticatedUser();
  await requireWorkspaceMembership({
    userId: user.id,
    workspaceId: parsed.data.workspaceId,
  });
  await acknowledgeWorkspaceActivity({ ...parsed.data, userId: user.id });
  revalidatePath("/app/activity");
}
