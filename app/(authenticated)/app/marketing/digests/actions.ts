"use server";

import { revalidatePath } from "next/cache";
import { acknowledgeMarketingWeeklyDigest } from "@/db/commands/marketing-weekly-digest-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { z } from "zod";

const digestIdSchema = z.uuid();

export async function acknowledgeMarketingWeeklyDigestAction(
  formData: FormData,
) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("UNAUTHENTICATED");
  const digestId = digestIdSchema.parse(formData.get("digestId"));
  await acknowledgeMarketingWeeklyDigest({
    workspaceId: context.activeMembership.workspaceId,
    digestId,
    userId: context.user.id,
  });
  revalidatePath("/app/marketing/digests");
}
