import type { Character, Scene, SceneVersion } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SceneStatusBadge } from "@/components/scenes/SceneStatusBadge";
import { SceneEditor } from "@/components/scenes/SceneEditor";
import { ApproveSceneButton } from "@/components/scenes/ApproveSceneButton";
import { SceneCharacterList } from "@/components/scenes/SceneCharacterList";

export function SceneCard({
  scene,
  version,
  canEdit,
  onDirtyChange,
  assignedCharacters,
  availableCharacters,
}: {
  scene: Scene;
  version: SceneVersion;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  assignedCharacters: Character[];
  availableCharacters: Character[];
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
        <SceneCharacterList
          assignedCharacters={assignedCharacters}
          availableCharacters={availableCharacters}
          canEdit={canEdit}
          projectId={scene.projectId}
          sceneId={scene.id}
          sceneVersionId={version.id}
        />
        <SceneEditor
          canEdit={canEdit}
          key={`${scene.id}-${scene.currentVersion}`}
          onDirtyChange={onDirtyChange}
          scene={scene}
          version={version}
        />
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
