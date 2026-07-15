# Phase 6 prompt: Storyboard and controlled bulk image generation

Read `AGENTS.md` and `README.md`.

Implement a storyboard interface and controlled bulk image generation.

## Storyboard requirements

Display every scene with:

```text
scene number
narration
characters
current approved image
latest generated image
generation status
approval status
duration
cost
error state
```

Users can:

```text
select scenes
generate selected scenes
generate all eligible scenes
exclude scenes
approve images
reject images
regenerate images
cancel queued generations
filter by status
retry selected failed scenes
```

## Bulk generation safety

Before starting:

```text
validate permissions
validate scene eligibility
display scene count
display estimated total cost
display remaining budget
require confirmation
enforce maximum batch size
```

Use Trigger.dev batch task functionality.

Do not fire hundreds of uncontrolled promises.

Respect the image generation queue concurrency.

One failed scene must not invalidate successful scenes.

The parent workflow must report:

```text
total
queued
running
succeeded
failed
cancelled
estimated cost
actual cost
```

## User interface

Create:

```text
Storyboard
StoryboardToolbar
StoryboardFilters
StoryboardGrid
StoryboardSceneCard
StoryboardSceneImage
StoryboardSceneMetadata
StoryboardSelectionCheckbox
BulkGenerateButton
BulkGenerateDialog
BulkGenerationSummary
BulkGenerationProgress
FailedSceneActions
RegenerateSceneDialog
ApproveSelectedImagesButton
StoryboardEmptyState
```

One component per file.

## Testing

Test:

```text
batch size enforcement
partial failures
parent progress aggregation
per scene idempotency
cancellation
retry selection
cost limit rejection
duplicate browser submission
scene approval
viewer access restrictions
```

Update `README.md` and verify all commands.
