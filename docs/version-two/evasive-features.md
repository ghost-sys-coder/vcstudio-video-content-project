# Evasive features: dynamic visual style, held scenes, multi-image scenes

Branch: `evasive-features`. Started 2026-09-11. Owner: Claude.

These three came from production experience rather than from the version-two
plan: the visual style was fixed to one niche, a long single-image video had no
way to be expressed, and a scene could hold only one image. This document
records what each one actually does, what has been proven, and what has not.

**Nothing here is deployed and nothing is merged.** The branch exists so the
multi-image workflow in particular can be exercised before it reaches
production.

## Status

| Feature                        | State       | Proven by                                                  |
| ------------------------------ | ----------- | ---------------------------------------------------------- |
| Visual style per niche/project | Built       | 29 unit tests, migration applied and verified in place     |
| Multiple images per scene      | Built       | 36 unit tests, 6 live PostgreSQL tests, migration verified |
| Held scene, sound, animation   | Not started | —                                                          |

No part of this branch has been observed in a browser. The environment's
command policy blocks starting the development server, so every claim below
rests on tests, type checking, lint, the production build and direct
inspection of the live database.

## 1. Visual style per niche and per project

### What was actually wrong

The architecture was already correct and simply had no entry point. The image
prompt builder in `packages/prompts/src/scene-image.ts` has always taken the
style as data. Styles have always been workspace-scoped and versioned. But
`createStylePreset` and `createStylePresetVersion` were called from nowhere, so
every workspace kept the one style seeded at creation and the picker held
exactly one entry for the life of the workspace.

Two consequences followed. A workspace producing for several niches had one
look imposed on all of them. And because the seeded style's exclusions forbid
photorealism outright, believable human beings were unreachable however a scene
was described.

### What it does now

Styles can be created, edited, made default, archived and restored from
workspace settings, gated by a new `manageStylePresets` capability. Eight
templates cover several niches; two of them aim at real people.

A project chooses its style when it is created, stored as a snapshot of one
style _version_ exactly as `formatPresetVersionId` is, so a later edit to the
style cannot change what a half-finished project is producing. It is a default
and not a lock: a single generation may still pick another style.

### Decisions worth keeping

**Editing appends a version.** Overwriting would make earlier images
unexplainable, because every generation stores the style version it used. The
form carries the version being edited as an optimistic lock, so two people
editing at once cannot silently discard each other.

**Preselection is an ordering, not a second flag.**
`orderStylePresetsForProject` puts the project's style first, then the
workspace default, then the rest in repository order. Both generate dialogs
then preselect correctly by taking the first entry, which avoided threading a
new prop through eight storyboard components and kept one meaning for
`isDefault`, so the "(default)" label stays true.

**Archiving refuses on the workspace default.** Succeeding would leave the
workspace with no default for image generation to fall back to. Nothing is ever
deleted, because projects and generations cite style versions as the record of
what finished videos were made from.

**The seeded default is deliberately unchanged.**
`ensureDefaultStylePreset` repairs a missing default by matching its slug, and
a partial unique index permits one unarchived default per workspace. Renaming
the seed would make that repair path try to insert a second default into every
existing workspace and fail. New workspaces therefore still start on the
stick-figure style; it is now editable, and the same look is also available as
a template so it survives being edited away.

### Not done

The style is not yet choosable when editing an existing project, only when
creating one. An existing project changes style per generation instead.

## 2. Held scene with sound and reactive animation

Not started. Design notes from the feasibility review, to be confirmed against
the code when the work begins:

- A long held image is better expressed as several scenes sharing one image
  than as one long scene. `MAX_SCENE_DURATION_MILLISECONDS` defaults to 60000
  and `MAX_NARRATION_CHARACTERS` to 4000, the latter near the speech provider's
  own per-request ceiling. Splitting also keeps caption timing per scene, which
  matters because a ten-minute scene divided by character count would be badly
  mistimed and the existing pause snapping is bounded at 400 ms.
- Background sound does not exist anywhere: not in the schema, not in
  `RenderTimelineSnapshot`, not in the Remotion tree. The media library is
  close but its kind enum admits images and video only.
- The reactive volume animation needs no new data. Every narration clip already
  stores a loudness envelope at 50 Hz, measured once with ffmpeg because the
  renderer needs it for mouth movement. The gap is that it reaches the
  composition only through character data, which static projects omit.

## 3. Multiple images per scene

Built. This is the feature the branch exists to exercise, and it should not be
treated as finished on the strength of tests alone: no multi-image scene has
been rendered.

### What it does

A scene may hold several approved stills. They divide the scene's narration
between them and each change is placed on a **caption boundary**, so it lands
where the narrator paused rather than over a word. Images cross-dissolve.

### Why caption boundaries

Caption times are already snapped onto silences measured in the narration's
amplitude envelope. Reusing them costs nothing, needs no new data to author,
and puts image changes in gaps in the voice. The alternatives were an even
split, which can change image mid-sentence, and hand-set durations, which have
to be re-checked every time the narration is replaced.

The placement divides the scene by time and then moves each division to the
nearest caption change. It cannot decide _which_ image belongs to which
sentence: a scene with two images and eight caption lines changes near the
middle, not at the semantically right moment.

### Two defects this exposed

**Approval demoted the wrong images.** Approving an image un-approved every
other approved image for that scene version at that size. With shots, approving
the second image would have silently emptied the first. Approval is now scoped
to the shot for exactly the reason it was already scoped to the size. There is
a live PostgreSQL test for this specific case.

**Two maps kept the wrong row.** Queries that returned at most one approved
image per scene version now return several, and two call sites built a map
straight from the array, which keeps whichever row arrived last. Both now call
a helper that states which image it wants, and the query orders by shot
explicitly so a render reproduces.

### What keeps existing work safe

The frozen render snapshot carries `shots` only when a scene has more than one
image — absent, not empty — so an existing render is byte-identical and
re-renders to the same video. `scene.image` stays populated as the scene's
representative still, so anything that does not understand shots still shows
the scene. Every pre-existing row carries shot 0, so the old uniqueness rule is
this rule restricted to a single shot.

A missing signed URL for a shot throws rather than falling back to the first
image. A silently single-image scene would look like the feature never applied,
and nothing would report it.

### Not done

- No multi-image scene has been rendered, so the dissolve has been verified by
  schema and unit test rather than by watching it.
- Reused images carried across a scene revision are always shot 0; multi-image
  reuse is not carried across a revision.
- Camera motion applies to the whole scene rather than per shot.
- Only two transitions exist, cut and fade, and shots always dissolve.
