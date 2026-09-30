import type { EditableSceneContent } from "@/lib/schemas/scene";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SceneNarrationField } from "@/components/scenes/SceneNarrationField";
import { SceneVisualDescriptionField } from "@/components/scenes/SceneVisualDescriptionField";
import { SceneCameraControls } from "@/components/scenes/SceneCameraControls";
import { SceneCharacterSelector } from "@/components/scenes/SceneCharacterSelector";
import { SceneDurationField } from "@/components/scenes/SceneDurationField";
import { SceneVoiceDirectionFields } from "@/components/scenes/SceneVoiceDirectionFields";

export function SceneContentFields({
  content,
  disabled,
  idPrefix,
}: {
  content: EditableSceneContent;
  disabled: boolean;
  idPrefix: string;
}) {
  return (
    <>
      <SceneNarrationField
        defaultValue={content.narrationText}
        disabled={disabled}
        id={`${idPrefix}-narrationText`}
      />
      <SceneVoiceDirectionFields
        disabled={disabled}
        emphasis={content.voiceEmphasis}
        idPrefix={idPrefix}
        pacing={content.voicePacing}
        tone={content.voiceTone}
      />
      <SceneVisualDescriptionField
        defaultValue={content.visualDescription}
        disabled={disabled}
        id={`${idPrefix}-visualDescription`}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["locationDescription", "Location", content.locationDescription],
          ["actionDescription", "Action", content.actionDescription],
        ].map(([name, label, value]) => (
          <div className="space-y-2" key={name}>
            <Label htmlFor={`${idPrefix}-${name}`}>{label}</Label>
            <Textarea
              defaultValue={value}
              disabled={disabled}
              id={`${idPrefix}-${name}`}
              name={name}
              required
            />
          </div>
        ))}
      </div>
      <SceneCameraControls
        angle={content.cameraAngle}
        disabled={disabled}
        idPrefix={idPrefix}
        motion={content.cameraMotion}
        shot={content.cameraShot}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-tone`}>Emotional tone</Label>
          <Input
            defaultValue={content.emotionalTone}
            disabled={disabled}
            id={`${idPrefix}-tone`}
            name="emotionalTone"
            required
          />
        </div>
        <SceneDurationField
          disabled={disabled}
          id={`${idPrefix}-estimatedDurationMilliseconds`}
          value={content.estimatedDurationMilliseconds}
        />
      </div>
      <SceneCharacterSelector
        characters={content.characterNames}
        disabled={disabled}
        idPrefix={idPrefix}
        props={content.propNames}
      />
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-continuity`}>Continuity notes</Label>
        <Textarea
          defaultValue={content.continuityNotes}
          disabled={disabled}
          id={`${idPrefix}-continuity`}
          name="continuityNotes"
        />
      </div>
    </>
  );
}
