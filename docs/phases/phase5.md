# Phase 5 prompt: Prompt composition and single scene image generation

Read `AGENTS.md` and `README.md`.

Implement versioned image prompt composition and generation for one scene at a time.

## Prompt system

Create composable prompt layers:

```text
global style preset
character identity
character reference requirements
scene setting
scene action
camera shot
camera angle
camera motion implication
emotional tone
continuity notes
negative constraints
output dimensions
aspect ratio
text exclusion rules
```

Create prompt templates as versioned source controlled modules.

Store the final prompt used for every request.

## Style presets

Implement workspace scoped style presets containing:

```text
name
description
positivePrompt
negativePrompt
defaultAspectRatio
isDefault
version
```

Include one initial stick figure financial education preset.

Do not rely on generated text inside images. Add visible text later during rendering.

## Image provider

Create a narrow `ImageGenerationProvider` interface.

Implement the OpenAI provider first.

The provider result must include:

```text
provider
model
request identifier
asset bytes or provider result
mime type
width
height
usage data
safe metadata
```

Make model, quality, format, and size configurable.

## Generation flow

```text
User opens approved scene
User chooses style preset
User selects character references
Application builds prompt preview
Application estimates cost
User confirms
Server creates generation record
Trigger.dev generates image
Result uploads to R2
Database stores asset
User reviews result
```

## Data model

Add:

```text
stylePresets
promptTemplateVersions
sceneImageGenerations
generationReferenceAssets
usageReservations
usageEvents
providerRequests
```

Generation status:

```text
pending
queued
running
succeeded
failed
cancelled
```

## Idempotency

The billable generation idempotency key must include:

```text
workspaceId
projectId
sceneVersionId
promptTemplateVersion
stylePresetVersion
generationVersion
model
quality
size
sorted reference asset identifiers
```

Do not return an old result when the user explicitly requests a new generation version.

## User interface

Create:

```text
SceneImagePanel
ImagePromptPreview
StylePresetSelector
ImageQualitySelector
ImageSizeSelector
ReferenceAssetSelector
GenerationCostEstimate
GenerateSceneImageButton
ImageGenerationProgress
GeneratedImageCard
GeneratedImageActions
ImageReviewDialog
ApproveGeneratedImageButton
RejectGeneratedImageButton
ImageGenerationErrorState
```

Every component must use its own PascalCase file.

## Testing

Test:

```text
prompt determinism
prompt versioning
reference ordering
idempotency keys
cost estimation
budget reservation
budget reconciliation
retry limits
R2 upload
generation authorization
provider failure classification
cross workspace reference rejection
```

Update `README.md` after completion.
