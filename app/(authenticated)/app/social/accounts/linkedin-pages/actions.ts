"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsertPlatformConnection } from "@/db/commands/platform-connection-commands";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { WORKSPACE_CONNECTIONS_PATH } from "@/lib/publishing/connections-navigation";
import {
  getLinkedInPagesSelectionContext,
  LinkedInPageSelectionError,
  type LinkedInPageSelectionState,
} from "@/lib/publishing/linkedin-pages-selection";
import { linkedInPagesResultPath } from "@/lib/publishing/linkedin-pages-navigation";
import {
  LINKEDIN_PAGES_COOKIE_OPTIONS,
  LINKEDIN_PAGES_SESSION_COOKIE,
} from "@/lib/publishing/linkedin-pages-session";
import { linkedInPageSelectionSchema } from "@/lib/schemas/linkedin-pages";

export async function connectLinkedInPageAction(
  _previous: LinkedInPageSelectionState,
  formData: FormData,
): Promise<LinkedInPageSelectionState> {
  if (formData.get("intent") === "cancel")
    await cancelLinkedInPageSelectionAction();
  const parsed = linkedInPageSelectionSchema.safeParse({
    pageId: formData.get("pageId"),
    start: formData.get("start"),
  });
  if (!parsed.success) return { error: "Choose a valid LinkedIn Page." };
  try {
    const { context, session, cookieStore, provider } =
      await getLinkedInPagesSelectionContext();
    // Resolve identity, name, and current membership afresh from LinkedIn.
    const result = await provider.listPages({
      accessToken: session.accessToken,
      start: parsed.data.start,
    });
    const page = result.pages.find(
      (candidate) => candidate.externalAccountId === parsed.data.pageId,
    );
    if (!page)
      return {
        error:
          "That Page is no longer available to this LinkedIn account. Reload the list or reconnect.",
      };
    await provider.assertCanPublish({ accessToken: session.accessToken, page });
    const connection = await upsertPlatformConnection({
      workspaceId: context.activeMembership.workspaceId,
      platform: "linkedin",
      account: {
        externalAccountId: page.externalAccountId,
        externalAccountName: page.externalAccountName,
        externalAccountUrl: page.externalAccountUrl,
      },
      tokens: {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt:
          session.tokenExpiresAtMs === null
            ? null
            : new Date(session.tokenExpiresAtMs),
        scopes: session.scopes,
      },
      connectedByUserId: context.user.id,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "platform_connected",
      targetType: "platform_connection",
      targetId: connection.id,
      metadata: { accountType: "linkedin_page" },
    });
    cookieStore.set(LINKEDIN_PAGES_SESSION_COOKIE, "", {
      ...LINKEDIN_PAGES_COOKIE_OPTIONS,
      maxAge: 0,
    });
    revalidatePath(WORKSPACE_CONNECTIONS_PATH);
  } catch (error) {
    if (error instanceof LinkedInPageSelectionError)
      return {
        error:
          error.status === "expired"
            ? "Page selection expired. Cancel and connect LinkedIn Pages again."
            : "You cannot connect a Page in this workspace. Check your access and reconnect.",
      };
    console.error("LinkedIn Page connection failed.");
    return {
      error:
        "The Page could not be connected. Check Community Management permissions and your Page role, then try again.",
    };
  }
  redirect(linkedInPagesResultPath("connected"));
}

export async function cancelLinkedInPageSelectionAction(): Promise<void> {
  (await cookies()).set(LINKEDIN_PAGES_SESSION_COOKIE, "", {
    ...LINKEDIN_PAGES_COOKIE_OPTIONS,
    maxAge: 0,
  });
  redirect(linkedInPagesResultPath("cancelled"));
}
