import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_VOICE_DIRECTION_LENGTH } from "@/lib/audio/voice-direction";

/**
 * How this scene's narration should be delivered.
 *
 * Sent to the voice with the narration, after the voice preset's own
 * instructions. Changing it makes approved narration stale, like changing the
 * words, because the same line delivered differently is a different take.
 */
export function SceneVoiceDirectionFields({
  tone,
  pacing,
  emphasis,
  disabled,
  idPrefix,
}: {
  tone: string;
  pacing: string;
  emphasis: string[];
  disabled: boolean;
  idPrefix: string;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Voice direction</legend>
      <p className="text-xs text-muted-foreground">
        How the narrator should deliver this scene. Tone and pacing are followed
        closely; emphasis is requested but not guaranteed, so listen before
        approving.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-voiceTone`}>Tone</Label>
          <Input
            defaultValue={tone}
            disabled={disabled}
            id={`${idPrefix}-voiceTone`}
            maxLength={MAX_VOICE_DIRECTION_LENGTH}
            name="voiceTone"
            placeholder="Curious, tense, intriguing"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-voicePacing`}>Pacing</Label>
          <Input
            defaultValue={pacing}
            disabled={disabled}
            id={`${idPrefix}-voicePacing`}
            maxLength={MAX_VOICE_DIRECTION_LENGTH}
            name="voicePacing"
            placeholder="Deliberate, building suspense"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-voiceEmphasis`}>Words to stress</Label>
        <Input
          aria-describedby={`${idPrefix}-voiceEmphasis-hint`}
          defaultValue={emphasis.join(", ")}
          disabled={disabled}
          id={`${idPrefix}-voiceEmphasis`}
          name="voiceEmphasis"
          placeholder="40 hours a week, poorer, missing piece"
        />
        <p
          className="text-xs text-muted-foreground"
          id={`${idPrefix}-voiceEmphasis-hint`}
        >
          Separate words or phrases with commas.
        </p>
      </div>
    </fieldset>
  );
}
