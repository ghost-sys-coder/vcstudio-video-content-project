import type { User } from "@clerk/nextjs/server";
import type { UserWebhookEvent } from "@clerk/nextjs/webhooks";
import type { SynchronizedUserProfile } from "@/db/repositories/users.repository";
import { ClerkSynchronizationError } from "@/lib/domain/errors";

export function profileFromClerkUser(user: User): SynchronizedUserProfile {
  const email = user.primaryEmailAddress?.emailAddress;

  if (!email) {
    throw new ClerkSynchronizationError(
      "The Clerk user does not have a primary email address.",
    );
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return {
    clerkUserId: user.id,
    email,
    displayName: fullName || user.username || email.split("@")[0] || "User",
    avatarUrl: user.hasImage ? user.imageUrl : null,
  };
}

export function profileFromClerkWebhook(
  event: Extract<UserWebhookEvent, { type: "user.created" | "user.updated" }>,
): SynchronizedUserProfile {
  const primaryEmail = event.data.email_addresses.find(
    (email) => email.id === event.data.primary_email_address_id,
  )?.email_address;

  if (!primaryEmail) {
    throw new ClerkSynchronizationError(
      "The verified Clerk webhook user has no primary email address.",
    );
  }

  const fullName = [event.data.first_name, event.data.last_name]
    .filter(Boolean)
    .join(" ");

  return {
    clerkUserId: event.data.id,
    email: primaryEmail,
    displayName:
      fullName || event.data.username || primaryEmail.split("@")[0] || "User",
    avatarUrl: event.data.has_image ? event.data.image_url : null,
  };
}
