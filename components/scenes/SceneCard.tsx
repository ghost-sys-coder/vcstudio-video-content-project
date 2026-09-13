import type {
  Character,
  ProjectVideoKind,
  Scene,
  SceneVersion,
} from "@/db/schema";
import type { SceneImageIndicator } from "@/lib/scenes/scene-image-indicator";
import type { SceneCharacterStaging } from "@/lib/scenes/scene-character-staging";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SceneImageIndicatorBadge } from "@/components/scenes/SceneImageIndicatorBadge";
import { SceneStatusBadge } from "@/components/scenes/SceneStatusBadge";
import { SceneEditor } from "@/components/scenes/SceneEditor";
import { ApproveSceneButton } from "@/components/scenes/ApproveSceneButton";
import { DeleteSceneButton } from "@/components/scenes/DeleteSceneButton";
import { SceneCharacterList } from "@/components/scenes/SceneCharacterList";
import { SceneImageWorkspace } from "@/components/scenes/SceneImageWorkspace";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SceneCard({
  scene,
  version,
  canEdit,
  onDirtyChange,
  assignedCharacters,
  characterStaging,
  availableCharacters,
  canGenerateImages,
  canReviewImages,
  imageIndicator,
  videoKind,
  totalSceneCount,
  coversApprovedScript,
}: {
  scene: Scene;
  version: SceneVersion;
  canEdit: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  assignedCharacters: Character[];
  characterStaging: SceneCharacterStaging[];
  availableCharacters: Character[];
  canGenerateImages: boolean;
  canReviewImages: boolean;
  imageIndicator?: SceneImageIndicator;
  videoKind: ProjectVideoKind;
  /** How many scenes the project has, so deletion can say what is renumbered. */
  totalSceneCount: number;
  /** True when the project's scenes are covering an approved script. */
  coversApprovedScript: boolean;
}) {
  return (
    // `overflow-visible` is load-bearing, not cosmetic: the card clips by
    // default, and a clipping ancestor makes the editor's sticky save bar stick
    // to the card instead of to the viewport, which is the same as not sticking
    // at all. Nothing here is an edge-to-edge image relying on the clip.
    <Card className="overflow-visible">
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
            <TabsTrigger className="gap-1.5" value="images">
              Images
              {imageIndicator ? (
                <SceneImageIndicatorBadge indicator={imageIndicator} />
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent className="space-y-5 pt-4" keepMounted value="details">
            <SceneCharacterList
              assignedCharacters={assignedCharacters}
              characterStaging={characterStaging}
              availableCharacters={availableCharacters}
              canEdit={canEdit}
              projectId={scene.projectId}
              sceneId={scene.id}
              sceneVersionId={version.id}
              videoKind={videoKind}
            />
            <SceneEditor
              canEdit={canEdit}
              key={`${scene.id}-${scene.currentVersion}`}
              onDirtyChange={onDirtyChange}
              scene={scene}
              version={version}
            />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <ApproveSceneButton
                approved={scene.status === "approved"}
                disabled={!canEdit}
                projectId={scene.projectId}
                sceneId={scene.id}
                version={scene.currentVersion}
              />
              {canEdit ? (
                <DeleteSceneButton
                  deletion={{
                    sceneNumber: scene.sceneNumber,
                    totalSceneCount,
                    // The indicator knows whether a scene has generated work,
                    // not how much, which is exactly what the warning claims.
                    hasGeneratedWork:
                      imageIndicator !== undefined &&
                      imageIndicator.state !== "none",
                    coversApprovedScript,
                  }}
                  projectId={scene.projectId}
                  sceneId={scene.id}
                />
              ) : null}
            </div>
          </TabsContent>
          <TabsContent className="pt-4" value="images">
            <SceneImageWorkspace
              assignedCharacters={assignedCharacters}
              canGenerate={canGenerateImages}
              canReview={canReviewImages}
              scene={scene}
              sceneVersion={version}
              videoKind={videoKind}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
