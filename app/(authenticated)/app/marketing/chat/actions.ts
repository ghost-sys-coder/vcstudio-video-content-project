"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createChatThread,
  setChatThreadStatus,
} from "@/db/commands/marketing-chat-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { WorkspacePermissionDeniedError } from "@/lib/domain/errors";
import { resolveMarketingAccess } from "@/lib/marketing/marketing-access";
import { requireCapability } from "@/lib/policies/workspace-policy";
import { archiveMarketingThreadSchema } from "@/lib/schemas/marketing-chat-request";

export type ChatActionResult = { ok: true } | { ok: false; error: string };

async function resolveContext() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context)
    return { ok: false as const, error: "Workspace context is unavailable." };

  requireCapability(context.activeMembership.role, "useMarketingChat");

  const access = await resolveMarketingAccess({
    workspaceId: context.activeMembership.workspaceId,
  });
  if (!access.available)
    return {
      ok: false as const,
      error:
        access.reason === "deployment_disabled"
          ? "The Marketing Studio is not enabled."
          : "The Marketing Studio is switched off for this workspace.",
    };

  return {
    ok: true as const,
    workspaceId: context.activeMembership.workspaceId,
    userId: context.user.id,
  };
}

/**
 * Creates an empty thread and navigates to it.
 *
 * The row exists before the first message so the streaming endpoint always
 * receives a thread id it can trust, and so a user who opens a conversation and
 * walks away leaves something they can come back to rather than nothing.
 *
 * `redirect` throws by design in Next, so it sits outside the try that catches
 * real failures — catching it would swallow the navigation.
 */
export async function startChatThreadAction(): Promise<void> {
  const context = await resolveContext();
  if (!context.ok) redirect("/app/marketing/chat");

  const thread = await createChatThread({
    workspaceId: context.workspaceId,
    createdByUserId: context.userId,
    title: "New conversation",
  });

  revalidatePath("/app/marketing/chat");
  redirect(`/app/marketing/chat/${thread.id}`);
}

export async function archiveChatThreadAction(
  formData: FormData,
): Promise<ChatActionResult> {
  const parsed = archiveMarketingThreadSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { ok: false, error: "That conversation could not be archived." };

  try {
    const context = await resolveContext();
    if (!context.ok) return context;

    await setChatThreadStatus({
      workspaceId: context.workspaceId,
      threadId: parsed.data.threadId,
      status: "archived",
    });

    revalidatePath("/app/marketing/chat");
    return { ok: true };
  } catch (error) {
    if (error instanceof WorkspacePermissionDeniedError)
      return { ok: false, error: "You do not have permission to do that." };
    return { ok: false, error: "That conversation could not be archived." };
  }
}
