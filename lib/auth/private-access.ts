import "server-only";
import { privateAccessEnvironmentSchema } from "@/lib/env/server-schema";
import type { z } from "zod";

export const PRIVATE_ACCESS_MESSAGE =
  "VCStudio is currently in private development. Join the waitlist for early access updates.";

export function canAccessPrivateApplication(
  clerkUserId: string | null | undefined,
  settings: z.infer<
    typeof privateAccessEnvironmentSchema
  > = privateAccessEnvironmentSchema.parse(process.env),
): boolean {
  return (
    !settings.ENABLE_PRIVATE_ACCESS ||
    (!!clerkUserId &&
      settings.PRIVATE_ACCESS_CLERK_USER_IDS.includes(clerkUserId))
  );
}

export function isPrivateApplicationPath(pathname: string): boolean {
  if (/^\/api\/webhooks\/clerk\/?$/.test(pathname)) return false;
  return /^\/(?:app|onboarding|invite|api)(?:\/|$)/.test(pathname);
}
