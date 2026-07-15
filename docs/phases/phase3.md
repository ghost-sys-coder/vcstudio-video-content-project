# Phase 3 prompt: Scene planning with structured OpenAI output

Read `AGENTS.md` and `README.md`.

Implement AI assisted conversion of an approved script version into editable structured scenes.

## Functional flow

```text
User opens a project
User selects an approved script version
User requests scene analysis
Application shows estimated API cost
User confirms
Server validates permissions and budget
Server creates a workflow run
Trigger.dev performs analysis
OpenAI returns schema constrained structured data
Application stores scene drafts transactionally
User reviews and edits scenes
User approves scenes
```

## Scene schema

Each scene should include:

```text
id
workspaceId
projectId
scriptVersionId
sceneNumber
narrationText
visualDescription
locationDescription
actionDescription
cameraShot
cameraAngle
cameraMotion
emotionalTone
characterNames
propNames
continuityNotes
estimatedDurationMilliseconds
startTimeMilliseconds
endTimeMilliseconds
status
version
createdAt
updatedAt
```

Scene statuses:

```text
draft
review
approved
generating
generated
revisionRequired
locked
```

## Scene versioning

Implement immutable scene versions.

Editing a scene creates a new version or increments versioned content through a clear domain operation. Preserve generated asset relationships with the exact scene version used.

## OpenAI integration

Use the current OpenAI Responses API and schema constrained structured output supported by the installed SDK.

Do not parse unstructured prose using fragile string operations.

Create a versioned scene analysis prompt in `@studio/prompts`.

Store:

```text
model
prompt version
final prompt
request identifier
input usage
output usage
estimated cost
actual cost
duration
status
error category
```

Make the model configurable through environment variables.

Do not hardcode an assumed model name.

## Durable task

Create a Trigger.dev task for scene analysis.

It must:

```text
validate input
check idempotency
check current script version
check budget reservation
call OpenAI
validate response
write scenes transactionally
record usage
reconcile budget
report progress
classify failures
avoid duplicate scenes on retry
```

## User interface

Create:

```text
ScenePlanner
ScenePlannerHeader
AnalyzeScriptButton
AnalysisCostDialog
AnalysisProgressPanel
SceneList
SceneCard
SceneEditor
SceneNarrationField
SceneVisualDescriptionField
SceneCameraControls
SceneCharacterSelector
SceneDurationField
SceneStatusBadge
ApproveSceneButton
ApproveAllScenesDialog
SceneAnalysisErrorState
```

Each component must occupy its own file.

## Testing

Test:

```text
structured output schema
prompt generation
idempotency
budget rejection
duplicate task retry
scene ordering
timing calculation
scene editing authorization
scene approval transitions
invalid OpenAI response handling
provider timeout handling
```

Update `README.md` after implementation.
