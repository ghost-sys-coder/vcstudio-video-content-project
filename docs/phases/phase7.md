# Phase 7 prompt: Scene narration generation, audio review, and timing

Read `AGENTS.md` and `README.md`.

Implement OpenAI text to speech generation per scene.

## Audio strategy

Generate one audio asset per scene.

The scene audio asset is authoritative for scene duration.

Do not generate only one monolithic narration file.

Support regeneration of an individual scene without regenerating the entire project.

## Voice configuration

Implement workspace voice presets:

```text
name
provider
model
voice
instructions
speed
format
sampleRate
isDefault
```

Only expose options supported by the installed OpenAI API and SDK.

## Generation flow

```text
User selects approved scenes
User chooses voice preset
Application estimates cost
User confirms
Trigger.dev generates audio
Audio uploads to R2
FFprobe inspects duration
Scene timing recalculates
Usage reconciles
User reviews audio
```

## Timing rules

Implement a deterministic timeline service that:

```text
orders scenes
uses actual audio durations
applies configured padding
calculates scene start times
calculates scene end times
converts milliseconds to frames
avoids cumulative floating point drift
```

## User interface

Create:

```text
AudioWorkspace
VoicePresetSelector
VoicePresetForm
SceneAudioList
SceneAudioRow
SceneAudioPlayer
GenerateSceneAudioButton
BulkGenerateAudioButton
AudioGenerationDialog
AudioGenerationProgress
AudioDurationDisplay
NarrationInstructionsField
ApproveSceneAudioButton
RegenerateSceneAudioDialog
AudioErrorState
```

One component per file.

## Testing

Test:

```text
audio prompt construction
voice preset validation
FFprobe parsing
duration calculations
frame conversion
timing recalculation
partial generation failure
budget control
idempotency
workspace isolation
```

Update `README.md`.
