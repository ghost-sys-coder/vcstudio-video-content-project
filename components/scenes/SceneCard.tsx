import type { Character, Scene, SceneVersion } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SceneStatusBadge } from "@/components/scenes/SceneStatusBadge";
import { SceneEditor } from "@/components/scenes/SceneEditor";
import { ApproveSceneButton } from "@/components/scenes/ApproveSceneButton";
import { SceneCharacterList } from "@/components/scenes/SceneCharacterList";
import { SceneImageWorkspace } from "@/components/scenes/SceneImageWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SceneCard({
  scene,
  version,
  canEdit,
  onDirtyChange,
  assignedCharacters,
  availableCharacters,
  projectAspectRatio,
  canGenerateImages,
  canReviewImages,
}: {
  scene: Scene;
  version: SceneVersion;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  assignedCharacters: Character[];
  availableCharacters: Character[];
  projectAspectRatio: "16:9" | "9:16" | "1:1";
  canGenerateImages: boolean;
  canReviewImages: boolean;
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
      <CardContent>
        <Tabs defaultValue="details">
          <TabsList aria-label="Scene workspace" variant="line">
            <TabsTrigger value="details">Scene details</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>
          <TabsContent className="space-y-5 pt-4" keepMounted value="details">
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
          </TabsContent>
          <TabsContent className="pt-4" value="images">
            <SceneImageWorkspace
              assignedCharacters={assignedCharacters}
              canGenerate={canGenerateImages}
              canReview={canReviewImages}
              projectAspectRatio={projectAspectRatio}
              scene={scene}
              sceneVersion={version}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
