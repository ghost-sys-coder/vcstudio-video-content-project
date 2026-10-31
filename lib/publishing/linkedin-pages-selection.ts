import "server-only";

import { cookies } from "next/headers";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getPublishingEnvironment } from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import {
  LINKEDIN_PAGES_SESSION_COOKIE,
  readLinkedInPagesSession,
  type LinkedInPagesSession,
} from "@/lib/publishing/linkedin-pages-session";
import { createLinkedInPagesProvider } from "@/lib/publishing/social-post-registry";

export type LinkedInPageSelectionState = { error: string | null };
export class LinkedInPageSelectionError extends Error {
  constructor(readonly status: "forbidden" | "expired" | "failed") {
    super(`LinkedIn Page selection: ${status}`);
  }
}

/** Bind session before any provider request; identifiers from the browser grant nothing. */
export async function getLinkedInPagesSelectionContext() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "manageSettings"))
    throw new LinkedInPageSelectionError("forbidden");
  const environment = getPublishingEnvironment();
  if (!environment.ENABLE_SOCIAL_POSTING)
    throw new LinkedInPageSelectionError("failed");
  const cookieStore = await cookies();
  const sealed = cookieStore.get(LINKEDIN_PAGES_SESSION_COOKIE)?.value;
  if (!sealed) throw new LinkedInPageSelectionError("expired");
  let session: LinkedInPagesSession;
  try {
    session = readLinkedInPagesSession({
      sealed,
      key: environment.PLATFORM_TOKEN_ENCRYPTION_KEY,
    });
  } catch {
    throw new LinkedInPageSelectionError("expired");
  }
  if (
    session.workspaceId !== context.activeMembership.workspaceId ||
    session.userId !== context.user.id
  )
    throw new LinkedInPageSelectionError("forbidden");
  return {
    context,
    session,
    cookieStore,
    provider: createLinkedInPagesProvider(),
  };
}

/** Keep provider reads and token-bearing records out of the page component. */
export async function loadLinkedInPagesSelection(start: number) {
  const { session, provider } = await getLinkedInPagesSelectionContext();
  const result = await provider.listPages({
    accessToken: session.accessToken,
    start,
  });
  return {
    start: result.start,
    nextStart: result.nextStart,
    pages: result.pages.map(({ externalAccountId, externalAccountName }) => ({
      id: externalAccountId,
      name: externalAccountName,
    })),
  };
}
