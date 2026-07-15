import type { Scene, SceneVersion } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SceneStatusBadge } from "@/components/scenes/SceneStatusBadge";
import { SceneEditor } from "@/components/scenes/SceneEditor";
import { ApproveSceneButton } from "@/components/scenes/ApproveSceneButton";

export function SceneCard({
  scene,
  version,
  canEdit,
}: {
  scene: Scene;
  version: SceneVersion;
  canEdit: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Scene {scene.sceneNumber}</CardTitle>
          <SceneStatusBadge status={scene.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          Version {scene.currentVersion} ·{" "}
          {(version.startTimeMilliseconds / 1000).toFixed(1)}s–
          {(version.endTimeMilliseconds / 1000).toFixed(1)}s
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <SceneEditor canEdit={canEdit} scene={scene} version={version} />
        <ApproveSceneButton
          approved={scene.status === "approved"}
          disabled={!canEdit}
          projectId={scene.projectId}
          sceneId={scene.id}
          version={scene.currentVersion}
        />
      </CardContent>
    </Card>
  );
}
