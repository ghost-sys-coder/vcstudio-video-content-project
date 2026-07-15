# Phase 8 prompt: Subtitle generation and timeline contracts

Read `AGENTS.md` and `README.md`.

Implement subtitle tracks and final typed timeline construction.

## Subtitle requirements

Support:

```text
scene level captions
sentence segments
word timing when reliable timing exists
SRT export
WebVTT export
Remotion caption input
caption style configuration
```

Do not fabricate word timestamps when only scene duration is known.

When exact word alignment is unavailable, use sentence or scene level timing.

## Timeline builder

Build a deterministic `VideoTimeline` from:

```text
approved scene version
approved image asset
approved audio asset
scene timing
caption track
camera motion
transition
render settings
```

Reject timeline construction when required assets are missing.

Return an actionable validation report listing missing or invalid assets by scene.

## User interface

Create:

```text
SubtitleWorkspace
SubtitleTrackSelector
SubtitleEditor
SubtitleSegmentList
SubtitleSegmentRow
CaptionStyleForm
SubtitlePreview
ExportSubtitleButton
TimelineValidationPanel
TimelineValidationIssue
BuildTimelineButton
```

One component per file.

## Testing

Test:

```text
SRT generation
WebVTT generation
segment overlap prevention
timeline deterministic output
missing asset validation
duration mismatch detection
frame count calculation
caption style validation
```

Update `README.md`.
