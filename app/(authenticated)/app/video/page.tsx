import { z } from "zod";
import { VideoStudioPage } from "@/components/video/VideoStudioPage";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import {
  videoCatalogView,
  videoHistoryView,
} from "@/lib/video-generation/video-generation-view";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import type { VideoGenerationTarget } from "@studio/contracts/video";
export default async function VideoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const workspaceId = context.activeMembership.workspaceId;
  const query = await searchParams;
  const parsed = z
    .object({ projectId: z.uuid(), sceneId: z.uuid() })
    .safeParse(query);
  let target: VideoGenerationTarget | undefined,
    initialPrompt: string | undefined;
  if (parsed.success) {
    const scene = await findCurrentScene({ workspaceId, ...parsed.data });
    if (scene) {
      target = {
        kind: "scene",
        ...parsed.data,
        sceneVersionId: scene.version.id,
        expectedSceneVersion: scene.scene.currentVersion,
      };
      initialPrompt = [
        scene.version.visualDescription,
        scene.version.actionDescription,
        scene.version.cameraMotion,
      ]
        .filter(Boolean)
        .join("\n\n");
    }
  }
  return (
    <VideoStudioPage
      workspaceId={workspaceId}
      catalog={videoCatalogView()}
      canGenerate={can(context.activeMembership.role, "mutateWorkspaceData")}
      history={await videoHistoryView(workspaceId)}
      target={target}
      initialPrompt={initialPrompt}
    />
  );
}
