import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { users, type UserThemePreference } from "@/db/schema";

export async function updateUserThemePreference(input: {
  userId: string;
  theme: UserThemePreference;
}) {
  const [user] = await getDatabase()
    .update(users)
    .set({ themePreference: input.theme, updatedAt: new Date() })
    .where(eq(users.id, input.userId))
    .returning();

  if (!user)
    throw new Error("User theme preference update returned no record.");
  return user;
}
