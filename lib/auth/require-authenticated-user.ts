import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";
import { redirect } from "next/navigation";
import { canAccessPrivateApplication } from "./private-access";
import { upsertSynchronizedUser } from "@/db/repositories/users.repository";
import { profileFromClerkUser } from "@/lib/auth/clerk-profile";
import { ClerkSynchronizationError } from "@/lib/domain/errors";

export const requireAuthenticatedUser = cache(async () => {
  await auth.protect();
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new ClerkSynchronizationError(
      "The authenticated Clerk user could not be loaded.",
    );
  }

  if (!canAccessPrivateApplication(clerkUser.id)) redirect("/waitlist");
  return upsertSynchronizedUser(profileFromClerkUser(clerkUser));
});
