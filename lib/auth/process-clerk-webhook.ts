import "server-only";

import type { WebhookEvent } from "@clerk/nextjs/webhooks";
import {
  completeWebhookDelivery,
  claimWebhookDelivery,
  failWebhookDelivery,
} from "@/db/repositories/webhook-events.repository";
import {
  softDeleteSynchronizedUser,
  upsertSynchronizedUser,
} from "@/db/repositories/users.repository";
import { profileFromClerkWebhook } from "@/lib/auth/clerk-profile";
import { routeClerkUserEvent } from "@/lib/auth/clerk-event-router";

function safeWebhookFailureMessage(error: unknown): string {
  if (error instanceof Error && error.name === "ClerkSynchronizationError") {
    return "Clerk user data could not be synchronized.";
  }

  return "Clerk webhook processing failed.";
}

export async function processClerkWebhook(input: {
  deliveryId: string;
  event: WebhookEvent;
}): Promise<"processed" | "duplicate"> {
  const claim = await claimWebhookDelivery({
    deliveryId: input.deliveryId,
    eventType: input.event.type,
  });

  if (claim === "duplicate") {
    return "duplicate";
  }

  try {
    await routeClerkUserEvent(input.event, {
      upsert: async (event) => {
        await upsertSynchronizedUser(profileFromClerkWebhook(event));
      },
      remove: softDeleteSynchronizedUser,
    });
    await completeWebhookDelivery(input.deliveryId);
    return "processed";
  } catch (error: unknown) {
    await failWebhookDelivery(
      input.deliveryId,
      safeWebhookFailureMessage(error),
    );
    throw error;
  }
}
