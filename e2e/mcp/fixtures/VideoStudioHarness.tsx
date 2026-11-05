import { VideoStudioPage } from "@/components/video/VideoStudioPage";
import { SceneVideoPanel } from "@/components/video/SceneVideoPanel";
import { ProjectVisualDefault } from "@/components/video/ProjectVisualDefault";
import {
  videoCatalog,
  videoWorkspace,
  videoProject,
  videoScene,
} from "./video-data";
export function VideoStudioHarness() {
  const mode = new URLSearchParams(location.search).get("mode");
  return (
    <div className="mx-auto max-w-7xl">
      {mode === "scene" ? (
        <div className="app-page">
          <ProjectVisualDefault
            workspaceId={videoWorkspace}
            projectId={videoProject}
            initialKind="image"
            updatedAt="2026-11-05T00:00:00.000Z"
            canEdit
          />
          <SceneVideoPanel
            workspaceId={videoWorkspace}
            projectId={videoProject}
            sceneId={videoScene}
            canEdit
          />
        </div>
      ) : (
        <VideoStudioPage
          workspaceId={videoWorkspace}
          catalog={videoCatalog}
          canGenerate
          history={{ items: [], nextCursor: null }}
          target={
            mode === "starter"
              ? {
                  kind: "scene",
                  projectId: videoProject,
                  sceneId: videoScene,
                  sceneVersionId: "44444444-4444-4444-8444-444444444444",
                  expectedSceneVersion: 1,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
