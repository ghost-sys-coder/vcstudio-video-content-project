import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { findProject } from "@/db/repositories/projects.repository";
import { findThumbnailGeneration } from "@/db/repositories/thumbnail-generation.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { isThumbnailObjectKey } from "@/lib/storage/object-key";
import { createThumbnailDownloadUrl } from "@/lib/storage/thumbnail-storage";

const routeParamsSchema = z.object({
  projectId: z.uuid(),
  thumbnailGenerationId: z.uuid(),
});

type Params = { projectId: string; thumbnailGenerationId: string };

const noStore = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<Params> },
) {
  const authentication = await auth();
  if (!authentication.userId)
    return new NextResponse(null, { status: 401, headers: noStore });

  const parsed = routeParamsSchema.safeParse(await context.params);
  if (!parsed.success)
    return new NextResponse(null, { status: 400, headers: noStore });

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext)
      return new NextResponse(null, { status: 403, headers: noStore });
    const workspaceId = workspaceContext.activeMembership.workspaceId;
    const project = await findProject({
      workspaceId,
      projectId: parsed.data.projectId,
    });
    if (!project)
      return new NextResponse(null, { status: 404, headers: noStore });

    const generation = await findThumbnailGeneration({
      workspaceId,
      projectId: project.id,
      thumbnailGenerationId: parsed.data.thumbnailGenerationId,
    });
    if (
      !generation ||
      generation.status !== "succeeded" ||
      !generation.assetObjectKey ||
      !isThumbnailObjectKey({
        workspaceId,
        projectId: project.id,
        platform: generation.platform,
        thumbnailGenerationId: generation.id,
        outputFormat: generation.outputFormat,
        objectKey: generation.assetObjectKey,
      })
    )
      return new NextResponse(null, { status: 404, headers: noStore });

    const response = NextResponse.redirect(
      await createThumbnailDownloadUrl(generation.assetObjectKey),
      307,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return new NextResponse(null, { status: 500, headers: noStore });
  }
}
