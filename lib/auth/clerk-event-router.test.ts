import type { UserWebhookEvent } from "@clerk/nextjs/webhooks";
import { describe, expect, it, vi } from "vitest";
import { routeClerkUserEvent } from "@/lib/auth/clerk-event-router";

const deletedEvent: UserWebhookEvent = {
  type: "user.deleted",
  object: "event",
  data: {
    object: "user",
    id: "user_123",
    deleted: true,
  },
  event_attributes: {
    http_request: { client_ip: "127.0.0.1", user_agent: "vitest" },
  },
};

describe("Clerk user event routing", () => {
  it("routes verified user deletion events to soft deletion", async () => {
    const remove = vi.fn(async () => undefined);
    const upsert = vi.fn(async () => undefined);

    await routeClerkUserEvent(deletedEvent, { remove, upsert });

    expect(remove).toHaveBeenCalledWith("user_123");
    expect(upsert).not.toHaveBeenCalled();
  });
});
