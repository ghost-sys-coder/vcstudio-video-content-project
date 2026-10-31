import "server-only";

import { eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { users } from "@/db/schema";
import type { ThemePreference } from "@/lib/schemas/user";

export async function updateUserThemePreference(input: {
  userId: string;
  theme: ThemePreference;
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
