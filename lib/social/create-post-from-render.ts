import "server-only";

import { createSocialPostForRender } from "@/db/commands/social-post-commands";
import { findProject } from "@/db/repositories/projects.repository";
import { findPublishableRenders } from "@/db/repositories/video-render.repository";
import { getPublishingEnvironment } from "@/lib/env/server";
import { plainTextToPortableDocument } from "@/lib/social/plain-text-to-document";
import { renderPortableDocumentToPlainText } from "@/lib/social/render-plain-text";

export class CreatePostFromRenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreatePostFromRenderError";
  }
}

/**
 * Creates a draft post carrying one of a project's finished renders.
 *
 * The bridge from the video pipeline into social posting. It deliberately stops
 * at a draft rather than publishing: destinations, the per-platform preview, the
 * character counters, and scheduling all already exist in the composer, and a
 * second publish path would be a second place for the capability matrix to drift
 * out of agreement with the first.
 *
 * The render is verified to belong to this workspace *and* this project before
 * it is attached — the foreign key alone would happily accept another project's
 * render id from a crafted request.
 */
export async function createPostFromRender(input: {
  workspaceId: string;
  projectId: string;
  renderId: string;
  commentary: string;
  createdByUserId: string;
}): Promise<{ postId: string }> {
  if (!getPublishingEnvironment().ENABLE_SOCIAL_POSTING)
    throw new CreatePostFromRenderError("Posting is disabled.");

  const project = await findProject({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
  });
  if (!project)
    throw new CreatePostFromRenderError("That project no longer exists.");

  const [render] = await findPublishableRenders({
    workspaceId: input.workspaceId,
    renderIds: [input.renderId],
  });
  if (!render || render.projectId !== input.projectId)
    throw new CreatePostFromRenderError(
      "That render is not available to post. Render the video first.",
    );

  const bodyDocument = plainTextToPortableDocument(input.commentary);

  const post = await createSocialPostForRender({
    workspaceId: input.workspaceId,
    // Named after the project so the posts list is readable without opening it.
    name: project.name,
    createdByUserId: input.createdByUserId,
    projectId: input.projectId,
    renderId: input.renderId,
    bodyDocument,
    // Derived on the server from the validated document, never taken from the
    // browser — this is the text that will actually be published.
    bodyPlainText: renderPortableDocumentToPlainText(bodyDocument),
  });

  return { postId: post.id };
}
