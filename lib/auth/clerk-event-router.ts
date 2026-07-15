import type { UserWebhookEvent, WebhookEvent } from "@clerk/nextjs/webhooks";

type SupportedClerkUserEvent = UserWebhookEvent;

export type ClerkUserEventHandlers = {
  upsert: (
    event: Extract<
      SupportedClerkUserEvent,
      { type: "user.created" | "user.updated" }
    >,
  ) => Promise<void>;
  remove: (clerkUserId: string) => Promise<void>;
};

export async function routeClerkUserEvent(
  event: WebhookEvent,
  handlers: ClerkUserEventHandlers,
): Promise<void> {
  switch (event.type) {
    case "user.created":
    case "user.updated":
      await handlers.upsert(event);
      return;
    case "user.deleted":
      if (event.data.id) {
        await handlers.remove(event.data.id);
      }
      return;
    default:
      return;
  }
}
