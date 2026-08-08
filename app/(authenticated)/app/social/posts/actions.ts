"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSocialPost,
  deleteSocialPostDraft,
  updateSocialPostDraft,
} from "@/db/commands/social-post-commands";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { findPublishableRenders } from "@/db/repositories/video-render.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { RateLimitExceededError } from "@/lib/domain/errors";
import {
  SocialPostPublicationError,
  startSocialPostPublication,
} from "@/lib/social/start-social-post-publication";
import {
  cancelSocialPostPublication,
  scheduleSocialPostPublication,
  SocialPostScheduleError,
} from "@/lib/social/schedule-social-post";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  cancelSocialPostScheduleSchema,
  createSocialPostSchema,
  deleteSocialPostSchema,
  publishSocialPostSchema,
  saveSocialPostSchema,
  scheduleSocialPostSchema,
} from "@/lib/schemas/social-post";
import { renderPortableDocumentToPlainText } from "@/lib/social/render-plain-text";

export type SaveSocialPostResult =
  | { ok: true; version: number; plainText: string }
  | { ok: false; error: string };

export type DeleteSocialPostResult =
  { ok: true } | { ok: false; error: string };

export async function createSocialPostAction(
  formData: FormData,
): Promise<{ ok: false; error: string } | never> {
  const parsed = createSocialPostSchema.safeParse({
    name: formData.get("name") ?? "",
    projectId: formData.get("projectId") || null,
  });
  if (!parsed.success) return { ok: false, error: "That post is not valid." };

  let postId: string;
  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "composePosts");

    const post = await createSocialPost({
      workspaceId: context.activeMembership.workspaceId,
      name: parsed.data.name,
      createdByUserId: context.user.id,
      projectId: parsed.data.projectId,
    });
    postId = post.id;
  } catch {
    return { ok: false, error: "That post could not be created." };
  }

  // Outside the try: `redirect` signals by throwing, so catching around it would
  // swallow the navigation and report a failure for a post that was created.
  revalidatePath("/app/social/posts");
  const composerBasePath =
    formData.get("composerBasePath") === "/app/marketing/publish"
      ? "/app/marketing/publish"
      : "/app/social/posts";
  redirect(`${composerBasePath}/${postId}`);
}

/**
 * Saves a draft's body and attachments.
 *
 * The plain text stored alongside the document is produced here, on the server,
 * from the validated document — never taken from the browser. It is what
 * actually gets published, so it must be derived from the same source of truth
 * the composer previewed.
 */
export async function saveSocialPostAction(
  formData: FormData,
): Promise<SaveSocialPostResult> {
  let bodyDocument: unknown;
  try {
    bodyDocument = JSON.parse(String(formData.get("bodyDocument") ?? "null"));
  } catch {
    return { ok: false, error: "The post body could not be read." };
  }

  const parsed = saveSocialPostSchema.safeParse({
    postId: formData.get("postId"),
    expectedVersion: formData.get("expectedVersion"),
    name: formData.get("name") ?? "",
    bodyDocument,
    // Sent as `source:id` pairs so one repeated field carries both, matching how
    // the rest of this form is encoded.
    attachments: formData
      .getAll("attachments")
      .map((value) => String(value))
      .filter((value) => value !== "")
      .map((value) => {
        const separator = value.indexOf(":");
        return {
          source: value.slice(0, separator),
          id: value.slice(separator + 1),
        };
      }),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That post is not valid.",
    };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "composePosts");
    const workspaceId = context.activeMembership.workspaceId;

    // Every attachment must still be live in *this* workspace. Checking here
    // rather than relying on the foreign key is what stops a crafted request
    // from attaching another tenant's media or another project's render.
    const libraryIds = parsed.data.attachments
      .filter((attachment) => attachment.source === "library")
      .map((attachment) => attachment.id);
    if (libraryIds.length > 0) {
      const assets = await findReadyMediaAssets({
        workspaceId,
        mediaAssetIds: libraryIds,
      });
      if (assets.length !== libraryIds.length)
        return {
          ok: false,
          error: "One of those attachments is no longer in the library.",
        };
    }
    const renderIds = parsed.data.attachments
      .filter((attachment) => attachment.source === "render")
      .map((attachment) => attachment.id);
    if (renderIds.length > 0) {
      const renders = await findPublishableRenders({
        workspaceId,
        renderIds,
      });
      if (renders.length !== renderIds.length)
        return {
          ok: false,
          error: "One of those renders is no longer available.",
        };
    }

    const plainText = renderPortableDocumentToPlainText(
      parsed.data.bodyDocument,
    );
    const result = await updateSocialPostDraft({
      workspaceId,
      postId: parsed.data.postId,
      expectedVersion: parsed.data.expectedVersion,
      name: parsed.data.name,
      bodyDocument: parsed.data.bodyDocument,
      bodyPlainText: plainText,
      attachments: parsed.data.attachments,
    });

    if (result.outcome === "not_editable")
      return {
        ok: false,
        error: "This post is already publishing and can no longer be edited.",
      };
    if (result.outcome === "conflict")
      return {
        ok: false,
        error:
          "This post was changed somewhere else. Reload to see the newer version before editing again.",
      };

    revalidatePath("/app/social/posts");
    revalidatePath(`/app/social/posts/${parsed.data.postId}`);
    return { ok: true, version: result.post.version, plainText };
  } catch {
    return { ok: false, error: "That post could not be saved." };
  }
}

export type PublishSocialPostResult =
  { ok: true; dispatched: number } | { ok: false; error: string };

function parseCaptionOverrides(formData: FormData): unknown {
  const value = formData.get("captionOverrides");
  if (typeof value !== "string" || value === "") return [];
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Sends a post to the chosen connected accounts now.
 *
 * `publishPosts` rather than `composePosts`: writing a draft and putting it in
 * front of an audience are different levels of trust, even though both are
 * owner/editor today.
 */
export async function publishSocialPostAction(
  formData: FormData,
): Promise<PublishSocialPostResult> {
  const parsed = publishSocialPostSchema.safeParse({
    postId: formData.get("postId"),
    connectionIds: formData
      .getAll("connectionIds")
      .map((value) => String(value))
      .filter((value) => value !== ""),
    requestNonce: formData.get("requestNonce"),
    captionOverrides: parseCaptionOverrides(formData),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Choose at least one account.",
    };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "publishPosts");

    const result = await startSocialPostPublication({
      workspaceId: context.activeMembership.workspaceId,
      postId: parsed.data.postId,
      connectionIds: parsed.data.connectionIds,
      requestNonce: parsed.data.requestNonce,
      captionOverrides: parsed.data.captionOverrides,
    });

    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "social_post_published",
      targetType: "social_post",
      targetId: parsed.data.postId,
      metadata: { destinations: result.dispatched },
    });

    revalidatePath("/app/social/posts");
    revalidatePath(`/app/social/posts/${parsed.data.postId}`);
    return { ok: true, dispatched: result.dispatched };
  } catch (error) {
    if (error instanceof SocialPostPublicationError)
      return { ok: false, error: error.message };
    if (error instanceof RateLimitExceededError)
      return {
        ok: false,
        error: "You're publishing too quickly. Please wait a moment.",
      };
    return { ok: false, error: "That post could not be published." };
  }
}

export type ScheduleSocialPostResult =
  { ok: true; scheduledAt: string } | { ok: false; error: string };

export async function scheduleSocialPostAction(
  formData: FormData,
): Promise<ScheduleSocialPostResult> {
  const parsed = scheduleSocialPostSchema.safeParse({
    postId: formData.get("postId"),
    scheduledAt: formData.get("scheduledAt"),
    timezone: formData.get("timezone"),
    connectionIds: formData
      .getAll("connectionIds")
      .map((value) => String(value))
      .filter((value) => value !== ""),
    requestNonce: formData.get("requestNonce"),
    captionOverrides: parseCaptionOverrides(formData),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That schedule is not valid.",
    };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "publishPosts");

    const result = await scheduleSocialPostPublication({
      workspaceId: context.activeMembership.workspaceId,
      postId: parsed.data.postId,
      scheduledAt: parsed.data.scheduledAt,
      timezone: parsed.data.timezone,
      connectionIds: parsed.data.connectionIds,
      requestNonce: parsed.data.requestNonce,
      captionOverrides: parsed.data.captionOverrides,
    });

    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      action: "social_post_scheduled",
      targetType: "social_post",
      targetId: parsed.data.postId,
      metadata: {
        destinations: parsed.data.connectionIds.length,
        timezone: parsed.data.timezone,
      },
    });

    revalidatePath("/app/social/posts");
    revalidatePath("/app/social/calendar");
    revalidatePath(`/app/social/posts/${parsed.data.postId}`);
    return { ok: true, scheduledAt: result.scheduledAt.toISOString() };
  } catch (error) {
    if (error instanceof SocialPostScheduleError)
      return { ok: false, error: error.message };
    return { ok: false, error: "That post could not be scheduled." };
  }
}

export async function cancelSocialPostScheduleAction(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = cancelSocialPostScheduleSchema.safeParse({
    postId: formData.get("postId"),
  });
  if (!parsed.success)
    return { ok: false, error: "That schedule could not be cancelled." };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "publishPosts");

    await cancelSocialPostPublication({
      workspaceId: context.activeMembership.workspaceId,
      postId: parsed.data.postId,
    });

    revalidatePath("/app/social/posts");
    revalidatePath("/app/social/calendar");
    revalidatePath(`/app/social/posts/${parsed.data.postId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof SocialPostScheduleError)
      return { ok: false, error: error.message };
    return { ok: false, error: "That schedule could not be cancelled." };
  }
}

export async function deleteSocialPostAction(
  formData: FormData,
): Promise<DeleteSocialPostResult> {
  const parsed = deleteSocialPostSchema.safeParse({
    postId: formData.get("postId"),
  });
  if (!parsed.success)
    return { ok: false, error: "That post could not be removed." };

  try {
    const context = await getAuthenticatedWorkspaceContext();
    if (!context)
      return { ok: false, error: "Workspace context is unavailable." };
    requireCapability(context.activeMembership.role, "composePosts");

    const result = await deleteSocialPostDraft({
      workspaceId: context.activeMembership.workspaceId,
      postId: parsed.data.postId,
    });
    if (!result.deleted)
      return {
        ok: false,
        error: "Only a draft can be deleted — a post that went out is history.",
      };

    revalidatePath("/app/social/posts");
    return { ok: true };
  } catch {
    return { ok: false, error: "That post could not be removed." };
  }
}
