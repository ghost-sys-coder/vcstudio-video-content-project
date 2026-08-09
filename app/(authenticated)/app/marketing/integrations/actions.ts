"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  disconnectGoogleBusiness,
  selectGoogleBusinessLocations,
} from "@/db/commands/google-business-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { syncGoogleBusiness } from "@/lib/marketing/integrations/sync-google-business";
import { requireCapability } from "@/lib/policies/workspace-policy";

export type GoogleBusinessActionResult =
  { ok: true; message: string } | { ok: false; error: string };

const selectionSchema = z.object({
  locationIds: z.array(z.uuid()).min(1, "Select at least one location."),
  primaryLocationId: z.uuid(),
});

async function ownerContext() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("AUTH_REQUIRED");
  requireCapability(context.activeMembership.role, "manageSettings");
  return context;
}

export async function saveGoogleBusinessSelectionAction(
  formData: FormData,
): Promise<GoogleBusinessActionResult> {
  const parsed = selectionSchema.safeParse({
    locationIds: formData.getAll("locationIds"),
    primaryLocationId: formData.get("primaryLocationId"),
  });
  if (!parsed.success)
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Location selection is invalid.",
    };
  try {
    const context = await ownerContext();
    await selectGoogleBusinessLocations({
      workspaceId: context.activeMembership.workspaceId,
      ...parsed.data,
    });
    revalidatePath("/app/marketing/integrations");
    revalidatePath("/app/marketing/brand/context");
    return { ok: true, message: "Business locations saved." };
  } catch {
    return { ok: false, error: "Business locations could not be saved." };
  }
}

export async function syncGoogleBusinessAction(): Promise<GoogleBusinessActionResult> {
  try {
    const context = await ownerContext();
    const result = await syncGoogleBusiness({
      workspaceId: context.activeMembership.workspaceId,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "google_business_synced",
      targetType: "google_business_connection",
      metadata: { locations: result.locations },
    });
    revalidatePath("/app/marketing/integrations");
    revalidatePath("/app/marketing/brand/context");
    return { ok: true, message: `Synchronized ${result.locations} locations.` };
  } catch {
    return {
      ok: false,
      error: "Google Business Profile could not be synchronized.",
    };
  }
}

export async function disconnectGoogleBusinessAction(): Promise<GoogleBusinessActionResult> {
  try {
    const context = await ownerContext();
    const connection = await disconnectGoogleBusiness({
      workspaceId: context.activeMembership.workspaceId,
    });
    if (!connection)
      return { ok: false, error: "Google Business Profile is not connected." };
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "google_business_disconnected",
      targetType: "google_business_connection",
      targetId: connection.id,
    });
    revalidatePath("/app/marketing/integrations");
    revalidatePath("/app/marketing/brand/context");
    return { ok: true, message: "Google Business Profile disconnected." };
  } catch {
    return {
      ok: false,
      error: "Google Business Profile could not be disconnected.",
    };
  }
}
