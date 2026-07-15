import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { clerkWebhookEvents } from "@/db/schema";

export type WebhookClaim = "claimed" | "duplicate";

export async function claimWebhookDelivery(input: {
  deliveryId: string;
  eventType: string;
}): Promise<WebhookClaim> {
  const [inserted] = await getDatabase()
    .insert(clerkWebhookEvents)
    .values(input)
    .onConflictDoNothing()
    .returning({ deliveryId: clerkWebhookEvents.deliveryId });

  if (inserted) {
    return "claimed";
  }

  const [existing] = await getDatabase()
    .select({ status: clerkWebhookEvents.status })
    .from(clerkWebhookEvents)
    .where(eq(clerkWebhookEvents.deliveryId, input.deliveryId))
    .limit(1);

  if (existing?.status !== "failed") {
    return "duplicate";
  }

  const [retried] = await getDatabase()
    .update(clerkWebhookEvents)
    .set({
      status: "processing",
      attemptCount: sql`${clerkWebhookEvents.attemptCount} + 1`,
      safeErrorMessage: null,
      startedAt: new Date(),
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(clerkWebhookEvents.deliveryId, input.deliveryId))
    .returning({ deliveryId: clerkWebhookEvents.deliveryId });

  return retried ? "claimed" : "duplicate";
}

export async function completeWebhookDelivery(
  deliveryId: string,
): Promise<void> {
  const now = new Date();
  await getDatabase()
    .update(clerkWebhookEvents)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(clerkWebhookEvents.deliveryId, deliveryId));
}

export async function failWebhookDelivery(
  deliveryId: string,
  safeErrorMessage: string,
): Promise<void> {
  await getDatabase()
    .update(clerkWebhookEvents)
    .set({ status: "failed", safeErrorMessage, updatedAt: new Date() })
    .where(eq(clerkWebhookEvents.deliveryId, deliveryId));
}
