"use server";

import { revalidatePath } from "next/cache";
import { createMarketingCompetitor } from "@/db/commands/marketing-research-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { marketingCompetitorInputSchema } from "@/lib/schemas/marketing-competitor";

export async function createMarketingCompetitorAction(formData: FormData) {
  const parsed = marketingCompetitorInputSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) throw new Error("Invalid competitor details.");
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("Workspace context unavailable.");
  requireCapability(context.activeMembership.role, "runMarketingResearch");
  await createMarketingCompetitor({
    workspaceId: context.activeMembership.workspaceId,
    name: parsed.data.name,
    websiteUrl: parsed.data.websiteUrl || null,
    notes: parsed.data.notes,
    createdByUserId: context.user.id,
  });
  revalidatePath("/app/marketing/research");
}
