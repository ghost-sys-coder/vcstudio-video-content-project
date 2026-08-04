"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  transitionMarketingContent,
  updateMarketingContentBody,
} from "@/db/commands/marketing-content-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  createPostFromContentItem,
  MarketingContentHandoffError,
} from "@/lib/marketing/publish/create-post-from-content-item";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  marketingContentIdSchema,
  reviewMarketingContentSchema,
} from "@/lib/schemas/marketing-content";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";
import { renderPortableDocumentToPlainText } from "@/lib/social/render-plain-text";

export async function reviewMarketingContentAction(formData: FormData) {
  const parsed = reviewMarketingContentSchema.safeParse({
    contentItemId: formData.get("contentItemId"),
    decision: formData.get("decision"),
    reviewNotes: formData.get("reviewNotes") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "That review is not valid." };
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context) return { ok: false, error: "Workspace unavailable." };
    requireCapability(context.activeMembership.role, "approveMarketingContent");
    const to =
      parsed.data.decision === "approve"
        ? "approved"
        : parsed.data.decision === "request_changes"
          ? "changes_requested"
          : "archived";
    await transitionMarketingContent({
      workspaceId: context.activeMembership.workspaceId,
      contentItemId: parsed.data.contentItemId,
      to,
      reviewedByUserId: context.user.id,
      reviewNotes: parsed.data.reviewNotes,
    });
    revalidatePath("/app/marketing/content");
    revalidatePath(`/app/marketing/content/${parsed.data.contentItemId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "That review could not be saved." };
  }
}

export async function updateMarketingContentAction(formData: FormData) {
  const id = marketingContentIdSchema.safeParse({
    contentItemId: formData.get("contentItemId"),
  });
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!id.success || !title || !body)
    return { ok: false, error: "Title and body are required." };
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context) return { ok: false, error: "Workspace unavailable." };
    requireCapability(context.activeMembership.role, "approveMarketingContent");
    const bodyDocument = plainTextToPortableDocument(body);
    await updateMarketingContentBody({
      workspaceId: context.activeMembership.workspaceId,
      contentItemId: id.data.contentItemId,
      title,
      bodyDocument,
      bodyPlainText: renderPortableDocumentToPlainText(bodyDocument),
      changedByUserId: context.user.id,
    });
    revalidatePath("/app/marketing/content");
    revalidatePath(`/app/marketing/content/${id.data.contentItemId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "That draft could not be updated." };
  }
}

export async function handoffMarketingContentAction(
  formData: FormData,
): Promise<{ ok: false; error: string } | never> {
  const parsed = marketingContentIdSchema.safeParse({
    contentItemId: formData.get("contentItemId"),
  });
  if (!parsed.success)
    return { ok: false, error: "That content item is invalid." };
  let postId: string;
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context) return { ok: false, error: "Workspace unavailable." };
    requireCapability(context.activeMembership.role, "approveMarketingContent");
    ({ postId } = await createPostFromContentItem({
      workspaceId: context.activeMembership.workspaceId,
      contentItemId: parsed.data.contentItemId,
      createdByUserId: context.user.id,
    }));
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof MarketingContentHandoffError
          ? error.message
          : "That content could not be handed off.",
    };
  }
  revalidatePath("/app/marketing/content");
  revalidatePath("/app/social/posts");
  redirect(`/app/social/posts/${postId}`);
}
