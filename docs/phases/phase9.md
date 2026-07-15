# Phase 9 prompt: Remotion preview and video rendering

Read `AGENTS.md` and `README.md`.

Implement video preview and durable video rendering.

## Composition requirements

Create reusable Remotion components for:

```text
scene image
camera motion
caption rendering
audio playback
scene transition
safe area guides
watermark
background
```

Each React component must have its own PascalCase file, including Remotion components.

## Supported formats

Initially support:

```text
1920 by 1080 landscape
1080 by 1920 vertical
1080 by 1080 square
```

Use configurable frames per second.

## Motion types

Support:

```text
none
zoomIn
zoomOut
panLeft
panRight
panUp
panDown
```

Motion must remain subtle and deterministic.

## Transitions

Support:

```text
cut
fade
```

Do not add a large transition library.

## Rendering flow

```text
User validates timeline
User selects render preset
Application estimates render requirements
User starts render
Trigger.dev queues rendering
Renderer validates input
Remotion renders output
Output uploads to R2
Database stores export
User receives completion state
```

Rendering must not occur inside a normal Vercel request.

Use the video rendering queue with concurrency one initially.

## User interface

Create:

```text
VideoPreviewWorkspace
VideoPreviewPlayer
RenderPresetSelector
RenderSettingsForm
TimelineSummary
RenderValidationDialog
StartRenderButton
RenderProgressPanel
RenderStatusBadge
RenderErrorState
ExportCard
ExportList
DownloadExportButton
```

One component per file.

## Testing

Test:

```text
composition input validation
duration calculation
aspect ratio configuration
caption safe areas
motion interpolation
render authorization
duplicate render idempotency
render failure recording
export workspace isolation
signed download authorization
```

Create at least one short automated smoke render where the environment permits it.

Update `README.md`.
