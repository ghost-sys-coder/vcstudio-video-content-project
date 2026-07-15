import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { users } from "@/db/schema";

export type SynchronizedUserProfile = {
  clerkUserId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function upsertSynchronizedUser(profile: SynchronizedUserProfile) {
  const [user] = await getDatabase()
    .insert(users)
    .values(profile)
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        deletedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!user) {
    throw new Error("User synchronization returned no user record.");
  }

  return user;
}

export async function softDeleteSynchronizedUser(
  clerkUserId: string,
): Promise<void> {
  await getDatabase()
    .update(users)
    .set({
      email: `deleted+${clerkUserId}@invalid.local`,
      displayName: "Deleted user",
      avatarUrl: null,
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.clerkUserId, clerkUserId));
}
