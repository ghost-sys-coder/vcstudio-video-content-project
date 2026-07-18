import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findProject } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { buildSubtitleContext } from "@/lib/subtitles/subtitle-workspace-details";
import { formatSrt } from "@/lib/subtitles/subtitle-srt";
import { formatWebVtt } from "@/lib/subtitles/subtitle-webvtt";
import {
  subtitleExportQuerySchema,
  subtitleRouteParamsSchema,
} from "@/lib/schemas/subtitle";

type Params = { projectId: string };

function sanitizeFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? slug : "subtitles";
}

export async function GET(
  request: Request,
  context: { params: Promise<Params> },
) {
  const authentication = await auth();
  if (!authentication.userId)
    return NextResponse.json(
      { success: false, error: "Authentication is required." },
      { status: 401 },
    );

  const parsedParams = subtitleRouteParamsSchema.safeParse(
    await context.params,
  );
  const parsedQuery = subtitleExportQuerySchema.safeParse({
    format: new URL(request.url).searchParams.get("format"),
  });
  if (!parsedParams.success || !parsedQuery.success)
    return NextResponse.json(
      { success: false, error: "The subtitle export request is invalid." },
      { status: 400 },
    );

  try {
    const workspaceContext = await getAuthenticatedWorkspaceContext();
    if (!workspaceContext)
      return NextResponse.json(
        { success: false, error: "Workspace access is required." },
        { status: 403 },
      );
    const project = await findProject({
      workspaceId: workspaceContext.activeMembership.workspaceId,
      projectId: parsedParams.data.projectId,
    });
    if (!project)
      return NextResponse.json(
        { success: false, error: "The project was not found." },
        { status: 404 },
      );

    const subtitles = await buildSubtitleContext({
      workspaceId: workspaceContext.activeMembership.workspaceId,
      project,
    });
    const format = parsedQuery.data.format;
    const body =
      format === "srt"
        ? formatSrt(subtitles.track, {
            maxLineCharacters: subtitles.captionStyle.maxLineCharacters,
          })
        : formatWebVtt(subtitles.track, {
            maxLineCharacters: subtitles.captionStyle.maxLineCharacters,
          });

    const filename = `${sanitizeFilename(project.name)}.${format}`;
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          format === "srt"
            ? "application/x-subrip; charset=utf-8"
            : "text/vtt; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "The subtitles could not be exported." },
      { status: 500 },
    );
  }
}
