"use server";

import { revalidatePath } from "next/cache";
import { createMarketingCompetitor } from "@/db/commands/marketing-research-commands";
import { findMarketingCompetitor } from "@/db/repositories/marketing-research.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { marketingCompetitorInputSchema } from "@/lib/schemas/marketing-competitor";
import { dispatchMarketingResearch } from "@/lib/marketing/research/dispatch-marketing-research";
import { redirect } from "next/navigation";

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

export async function requestCompanyResearchAction(formData: FormData) {
  const topic = String(formData.get("topic") ?? "").trim();
  if (!topic || topic.length > 500) throw new Error("Enter a research topic.");
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("Workspace context unavailable.");
  requireCapability(context.activeMembership.role, "runMarketingResearch");
  await dispatchMarketingResearch({
    workspaceId: context.activeMembership.workspaceId,
    requestedByUserId: context.user.id,
    kind: "company",
    topic,
    requestNonce: crypto.randomUUID(),
  });
  redirect("/app/marketing/research?researchQueued=1");
}

export async function requestCompetitorResearchAction(formData: FormData) {
  const competitorId = String(formData.get("competitorId") ?? "");
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("Workspace context unavailable.");
  requireCapability(context.activeMembership.role, "runMarketingResearch");
  const competitor = await findMarketingCompetitor({
    workspaceId: context.activeMembership.workspaceId,
    competitorId,
  });
  if (!competitor) throw new Error("Competitor not found.");
  await dispatchMarketingResearch({
    workspaceId: context.activeMembership.workspaceId,
    requestedByUserId: context.user.id,
    kind: "competitor",
    topic: competitor.name,
    competitorId: competitor.id,
    requestNonce: crypto.randomUUID(),
  });
  redirect("/app/marketing/research?researchQueued=1");
}
