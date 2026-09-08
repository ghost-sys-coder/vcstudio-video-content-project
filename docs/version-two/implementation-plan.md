# Implementation plan

Created: 2026-09-08. Implementation status lives in the [build tracker](build-tracker.md).

## Delivery rules

Each slice is a reviewable increment with its own tests, documentation update, migration record, and rollback notes. Inspect the current implementation before changing it. Paths below are starting points, not a final list of files to edit.

PostgreSQL remains authoritative. New workspace-owned records require tenant-scoped access, centralized role policies, validated inputs, constraints, bounded queries, and concurrency protection. Use supported atomic operations for the configured Neon/Drizzle driver. Never rewrite applied migrations or historical generation records.

Keep business logic outside React components; use one PascalCase component per file and thin framework routes. New billable operations require estimates, explicit consent, budget reservations, idempotency, bounded retries, and reconciliation. No new dependency, provider, migration, or environment variable is introduced merely by this plan.

Provider-dependent slices must verify current official documentation, scopes, account capabilities, costs, and limits during implementation. Record unsupported capabilities as unavailable or external steps; do not imply they are implemented.

## Phase 0: Establish evidence

The creator selected [Money Made Clear](money-made-clear.md) on 2026-09-08: weekly 8–12 minute faceless financial education, 20–40 scenes, mixed footage/stills, programmatic financial visuals, low-volume music/selective effects, and 3–5 vertical derivatives. These choices resolve the format-selection checkpoint; the live measured walkthrough remains pending.

### V2-00 — Representative formats and baseline

**Depends on:** none. **Change areas:** this folder; fixture and browser-test planning.

Choose representative real channel formats and document a long-form video plus a derived Short. Record channel audience, typical duration, voice, visual requirements, factual-review needs, release cadence, and steps currently completed outside VCStudio. Start with manual timing rather than new telemetry infrastructure.

Acceptance:

- Record at least one baseline walkthrough with hands-on time, waiting time, costs, blockers, and external finishing steps. Label simulator and live evidence separately.
- Define repeatable test fixtures including an early-scene revision, unsaved script, failed generation, and interrupted upload.
- Record which Phase 4 media features are required by those formats; do not infer every channel needs animated characters or B-roll.
- Capture outstanding channel preferences as decisions in the tracker. Use sanitized examples in committed documentation.

## Phase 1: Protect work

### V2-01 — Revision safety and asset compatibility

**Depends on:** V2-00. **Change areas:** `db/commands/scene-commands.ts`, scene/media repositories, timeline builders, scene editing, database integration tests.

Separate content identity from derived timeline positioning. Define a tested compatibility matrix for narration, visual description, character references, motion/framing, and timing changes. Version the affected content only. Reuse compatible assets through explicit provenance or bindings without rewriting the original generation's prompt, version, or ledger history.

Acceptance:

- Saving a no-op does not create new versions; editing an early scene does not version or reset unchanged later scenes.
- A narration-only change invalidates affected narration/alignment; an image-only change retains compatible narration. Changes affecting both mark both explicitly.
- Timeline positions recompute without discarding unrelated image/audio approvals, caption overrides, framing, or Shorts references. Explicitly test each derivative.
- The editor previews affected assets and any regeneration estimate before committing a consequential edit.
- Concurrent edits resolve atomically with a conflict response, not partial version updates.
- Old renders remain reproducible; existing projects migrate without guessed asset compatibility or automatic provider spending.

**Data/rollout:** likely requires versioned bindings or compatibility metadata. Decide the exact schema after reproducing the failure with fixtures. Backfill only provably compatible relationships; expose ambiguous cases for review.

### V2-02 — Recoverable script editing and approval

**Depends on:** V2-01. **Change areas:** `ScriptEditor`, script actions/commands, focused draft hooks, Playwright.

Add debounced server autosave with revision checking, an explicit save-state indicator, and recoverable local drafts. Collapse save/version/approve mechanics into an intentional production approval action that freezes a saved revision.

Acceptance:

- Reload, navigation, network loss, and reconnect preserve or explicitly recover typed work.
- A stale tab cannot overwrite a newer server revision; the creator can inspect and resolve a conflict.
- Local recovery is scoped to user, workspace, project, and revision; clear it on explicit discard/sign-out and define bounded retention. Never store tokens or signed URLs there.
- Approval flushes pending edits and approves exactly that revision once. Generated script insertion does not silently replace unsaved edits.
- Viewers cannot save/approve; keyboard users can inspect save errors and recover work.

**Data/rollout:** prefer the existing draft revision model. Keep immutable version history and restore behavior available.

### V2-03 — Verified script-to-scene fidelity

**Depends on:** V2-01. **Change areas:** scene-analysis worker, domain validation, versioned prompts, usage reconciliation.

Check that concatenated scene narration covers the approved script exactly once and in order, using a documented normalization policy limited to harmless formatting differences. Do not normalize away punctuation or word changes that alter meaning.

Acceptance:

- Missing, duplicated, reordered, and invented narration fails validation before becoming the active scene plan.
- Multilingual text, punctuation, repeated phrases, and boundary whitespace have meaningful test cases.
- A failed analysis preserves the previous usable plan and reports an actionable discrepancy.
- Provider usage is recorded even when paid output fails validation; any repair attempt has bounded retries and budget handling.
- Rendered scene narration and the approved script can be compared during review.

**Data/rollout:** store a safe validation result and immutable input identity where needed; do not rewrite existing approved scripts.

## Phase 2: Repeat production

### V2-04 — Channel production profiles

**Depends on:** V2-01. **Change areas:** schema/migrations, workspace channels, project creation, publishing selection, policies.

Create workspace-owned channel profiles independent of OAuth credentials. Link profiles to connections when available. Add optional project-channel assignment, audience/language/tone defaults, cadence/timezone, and channel resource references.

Acceptance:

- Multiple YouTube channels retain distinct profiles and project lists within one workspace.
- New projects inherit the intended channel; unassigned legacy projects remain usable.
- Upload targets come from explicit project/release selection, never an unrelated first active connection.
- Reconnecting or revoking OAuth preserves production identity and history while blocking unavailable publication actions.
- Profile assignment and defaults cannot reference another workspace's resources.

**Data/rollout:** additive channel/profile relations; no automatic assignment of historical projects to an arbitrary account.

### V2-05 — Reusable formats and channel idea backlog

**Depends on:** V2-04. **Change areas:** briefs, idea library, create-project flow, voice/style/caption defaults, prompts.

Define a small versioned format preset: audience and editorial structure, target duration, voice/style references, captions, output dimensions, cast when applicable, and budget defaults. Organize saved ideas by channel, series/format, priority, and intended release window.

Acceptance:

- A creator starts a recurring video with inherited settings and sees which values were inherited or overridden.
- Projects snapshot the preset version; editing a preset never silently changes in-progress videos.
- Existing saved-idea-to-project creation is reused, with duplicate-use history visible rather than silently preventing deliberate follow-ups.
- Channel defaults never bypass cost confirmation, maximum limits, or role checks.
- Manual ideas and blank projects remain supported; no paid idea-generation expansion is required.

**Data/rollout:** versioned preset/snapshot and optional backlog metadata. Prefer references to existing voice/style resources over duplicate libraries.

### V2-06 — Production queue and derived readiness

**Depends on:** V2-01, V2-04, V2-05. **Change areas:** dashboard/project queries, domain readiness resolver, project list and overview.

Show videos by channel, intended release date, blockers, review needs, and next action. Compute readiness from current approved content, assets, jobs, renders, and publications. Keep editorial planning status separate from technical readiness and release status.

Acceptance:

- A project can show "3 images awaiting review" or "Render failed" with the exact recovery link.
- Published, rendered, and scheduled are distinct states; manual Settings status cannot manufacture readiness.
- A partial batch failure remains visible and cannot produce a generic success badge.
- Queue filters are paginated and tenant-scoped; dashboard queries remain bounded.
- Spend labels accurately identify their coverage and period; reuse existing usage read models rather than presenting image spend as total production cost.

**Data/rollout:** persist editorial intent such as due date; derive operational state. Reuse Activity and Readiness services instead of creating a second workflow engine.

### V2-07 — Guided production workspace

**Depends on:** V2-02, V2-03, V2-06. **Change areas:** project navigation, Scenes/Storyboard, audio/subtitles/render entry points.

Introduce a project overview and stage-appropriate primary action. Offer scene grid and detail views in one production context; place caption review in assembly while retaining detailed editors and deep links. Present Characters and voice enrollment as reusable resources, surfaced when needed by the format.

Acceptance:

- The representative workflow can advance without knowing all eight current tabs.
- Scene selection, filters, drafts, review state, and keyboard navigation survive view changes.
- Existing routes/bookmarks continue working or redirect to equivalent context.
- Bulk generation and review remain available; failed scenes and per-operation costs remain visible.
- Navigation changes do not automatically trigger billable work or remove required editorial approval.

**Data/rollout:** normally no new authoritative workflow table. Deliver incrementally with a reversible navigation switch if needed.

## Phase 3: Complete releases

### V2-08 — Persistent release package and packaging review

**Depends on:** V2-02, V2-04. **Change areas:** publish panel/actions, title/thumbnail selection, publishing schema and commands.

Persist a versioned release draft by project, output/Short, and destination. Include exact render, title, description, tags, chosen thumbnail/captions, audience setting, and release intent. Allow title/thumbnail planning before rendering; require a valid render before dispatch.

Acceptance:

- Edited metadata survives reload and channel switching without leaking one destination's copy into another.
- Favorites remain suggestions; a release selects an explicit title and thumbnail rather than silently following later favorite changes.
- Preview the title/thumbnail together at a small display size and confirm the intended channel.
- Freeze the submitted package; later edits create a revision and cannot mutate an in-flight upload.
- Changing source content marks affected renders/packages stale and requires explicit reconfirmation.

**Data/rollout:** release-draft revisions and references, optimistic locking, and tenant constraints. Preserve existing publication rows and history.

### V2-09 — YouTube release completion

**Depends on:** V2-08. **Change areas:** existing YouTube provider, publication worker/state, assets, publish controls.

Extend the existing upload workflow with selected-thumbnail attachment, supported caption upload, explicit audience controls, and playlist selection where the account/API permits. Evaluate other required disclosure fields against current official documentation; do not invent platform requirements.

Acceptance:

- Remove the hardcoded audience decision; validate and send the creator's explicit setting.
- Persist video upload, thumbnail, captions, and playlist outcomes separately. A finishing failure resumes that step without re-uploading the video.
- Unsupported account capabilities show a specific external finishing action; "complete" never hides required unfinished work.
- Existing approved subtitle exports can be attached before speech alignment ships.
- Simulated tests prove retry behavior; a separately recorded private live upload verifies account capabilities and the finished package.

**Data/rollout:** additive provider-step state; reuse resumable upload identity. Record scope/consent changes and avoid requesting unrelated permissions.

### V2-10 — Scheduling and release calendar

**Depends on:** V2-06, V2-09. **Change areas:** release package, calendar/read models, publication orchestration and reconciliation.

Add explicit scheduled release time, timezone, cancel/reschedule, and platform confirmation. Prefer provider-native scheduling when verified and available; distinguish upload timing from public release timing. Reuse shared publishing mechanisms without duplicating the Social scheduler.

Acceptance:

- Persist UTC instants plus display timezone; test daylight-saving boundaries even if current channels use a fixed-offset timezone.
- Distinguish intended, submitted, provider-confirmed scheduled, published, missed, and failed states.
- Repeated dispatch and reconciliation do not duplicate publication. Cancel/reschedule race behavior is documented and tested.
- The UI exposes achievable scheduling precision and any external steps or account restrictions.
- Scheduling continues with Marketing Studio disabled and respects existing worker/schedule capacity and database wake-up constraints.

**Data/rollout:** add schedule intent and provider confirmation fields as needed. Do not promise precision based on the existing ten-minute sweeper.

## Phase 4: Improve finished-video quality

### V2-11 — Source-backed editorial review

**Depends on:** V2-03, V2-05. **Change areas:** briefs/scripts, source and claim contracts, prompts, review UI.

Start with manually attached source URLs/notes and claim-to-source review. Snapshot relevant evidence with a script revision. Add automated retrieval only if actual channel research needs justify its cost and complexity; reuse compatible ingestion utilities without coupling to Marketing Studio enablement.

Acceptance:

- Reviewers can distinguish supported claims, disputed claims, and unchecked claims before script approval.
- A factual-accuracy prompt is described as guidance, never proof that claims were verified.
- Material script edits invalidate the affected editorial sign-off; approved evidence remains reproducible.
- Source content is untrusted input and cannot override application instructions or authorization.
- Any automated retrieval/generation has explicit budget handling, provenance, and a documented supported source set.

**Data/rollout:** tenant-owned evidence and review records bound to immutable script versions. No vector database or new research provider by default.

### V2-12 — Speech-aligned captions and timing review

**Depends on:** V2-01, V2-07. **Change areas:** media tasks, subtitle contracts/commands/editor, timeline and render snapshots.

Evaluate a narrow alignment/transcription interface against recorded and generated narration fixtures. Store audio-specific timing provenance and expose synchronized playback plus cue timing adjustment. Keep approximate timing clearly labeled as a fallback.

Acceptance:

- Audio approval/replacement invalidates only dependent alignment; manual caption corrections have explicit revision behavior.
- Pauses, names, non-English samples, and departures from the written script have reviewable results.
- Cues can be adjusted, split, and merged without negative times or unintended overlap; preview, SRT/VTT, and renders agree.
- A failed alignment preserves usable audio and approximate captions, with no false "aligned" label.
- Provider selection, measured accuracy, cost, privacy behavior, and retry policy are recorded before enabling a paid path.

**Data/rollout:** versioned timing tracks tied to audio identity; old render snapshots remain valid. Existing proportional timing is not retrospectively relabeled.

### V2-13 — Format-driven visual assembly

**Depends on:** V2-01, V2-05, V2-07. **Change areas:** timeline contracts, media assets/inspection, visual editor, Remotion.

Implement only the V2-00 format requirements: multiple visual shots under continuous narration and, where needed, uploaded B-roll with trim/framing. Include basic scene split/merge/reorder behavior through the revision-safe model. Retain illustrated and animated formats without imposing a mixed-media requirement on all projects.

Money Made Clear selects mixed stock/already-generated footage and stills, deterministic motion graphics, animated text/numerical callouts, charts/graphs/tables, and illustrative screen UI. Use small versioned templates driven by validated data. Direct paid video generation is a separate provider decision; importing generated footage is part of the inspected-video path.

Acceptance:

- Shot timing is independent of narration segmentation and can be reviewed without regenerating narration.
- Uploaded clips are inspected; trim, duration, codec handling, and fit are validated before render.
- Mixed-media capability is explicit per format; unsupported combinations cannot create a misleading preview.
- Preview and worker output use the same versioned contract; existing snapshots still render.
- Asset source/rights notes and missing-media recovery are available for imported material.
- Programmatic charts, tables, and callouts preserve units, currencies, source dates, assumptions, and rounding. Synthetic data is labeled. Chart axes and labels match the data; numbers are not synthesized as AI image text.
- Graphics and screen examples preview and render deterministically in landscape and vertical layouts with legible text and safe areas. Animated characters remain optional and are not a Money Made Clear acceptance requirement.

**Data/rollout:** additive visual-track/shot model and snapshot versioning. No arbitrary multi-track editor or new paid video generator.

### V2-14 — Narration consistency and basic audio mix

**Depends on:** V2-01, V2-05, V2-13. **Change areas:** media processing, audio review, render audio contract and composition.

Implement narration loudness/peak inspection and review across scenes. Add music-bed gain, fade, and narration ducking only for formats selected in V2-00; add sound effects only if those formats require them.

Money Made Clear requires the low-volume music bed and selective effects: both are now selected scope for this slice. Narration intelligibility, reusable gain/fade defaults, and sparse explicit effect placement take priority over sophisticated sound design.

Acceptance:

- Preserve original audio and create versioned processed derivatives; do not normalize by mutating an approved original.
- Inspect whole-video narration for abrupt level changes and clipping using a documented project target.
- Selected mix controls preview consistently and freeze in rendered outputs, including Shorts.
- Track source/rights information for imported music; enforce private storage and authorized access.
- FFmpeg runs in durable media tasks with argument arrays, bounded concurrency, and safe failures.

**Data/rollout:** versioned processing/mix settings and derivatives. No music-generation subscription or library dependency by default.

### V2-15 — Derived Shorts production

**Depends on:** V2-08, V2-12, V2-13, V2-14. **Change areas:** existing Shorts editor/timeline, output framing, release packages.

Extend the existing clip-selection and trim flow with standalone hook/payoff review, caption/framing checks, and a separate release package. Reuse existing native-size images and free framing before any paid outpaint proposal.

For Money Made Clear, produce 3–5 distinct editorial clips per long video and prepare each for YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels through existing platform services. The technical fixture uses four 45-second candidates; this is not a universal platform duration rule.

Acceptance:

- A Short reuses selected approved material without regenerating unaffected media.
- Source revisions mark compatibility/staleness explicitly; a saved Short never silently drifts to different source content.
- Preview/export respects trimmed narration, aligned captions, visual shots, and mix settings.
- Short title, thumbnail where supported, channel, and schedule are independent from the parent release.
- Eligibility labels use verified platform rules and do not confuse an aspect ratio with a complete editorial Short.
- Vertical derivatives reflow chart labels, table columns, screen illustrations, and numerical callouts instead of cropping away important financial context. Preserve source/assumption labels and make each hook/takeaway self-contained.

**Data/rollout:** extend current Short/output entities; avoid introducing a competing Short project system.

## Phase 5: Learn and validate

### V2-16 — Production outcome measurement

**Depends on:** V2-06, V2-10. **Change areas:** release/usage/activity read models and production reporting.

Implement the agreed measures from manual baselines using existing timestamps and usage records where possible. Record revision reason when needed to distinguish deliberate variants from avoidable regeneration. Keep manual active-time entry until automatic measurement has a defensible idle policy.

Acceptance:

- Report hands-on time, queue/wait time, blocked age, planned/actual releases, and per-video cost separately.
- State which cost sources are included; never double-count reservations as actual spend or silently omit known categories.
- Shared channel resources have an explicit allocation policy or remain separately reported.
- Small samples and missing measurements are visible; simulated work is excluded from live production totals.

**Data/rollout:** additive event/reason fields only when existing data is insufficient. No incidental Sentry/PostHog dependency; the earlier roadmap defers those separately.

### V2-17 — Independent YouTube performance refresh

**Depends on:** V2-04, V2-10. **Change areas:** existing performance observations/provider sync, OAuth refresh, shared sweeper.

Expose video performance outside Marketing Studio. Reuse append-only observations and provenance. Remove both deployment and workspace Marketing Studio gates from the video-performance path while preserving Marketing Studio behavior. Refresh expired tokens through the existing authorized provider service.

Acceptance:

- Video observations refresh with both Marketing Studio switches off; unrelated marketing jobs remain off.
- Missing permissions, stale tokens, quota limits, no data, and true zero values are distinguishable.
- Views/likes/comments remain supported; add watch time, retention, and click-through metrics only after verifying account access and current API support.
- Manual imports, if needed, validate units/date ranges/source and prevent duplicate observations; unavailable metrics are not fabricated.
- Scheduling stays bounded and avoids consuming a hosted schedule slot without checking capacity.

**Data/rollout:** extend existing metric contracts only as necessary; preserve historical definitions. Keep a single refresh owner during scheduler transition.

### V2-18 — Performance-informed planning

**Depends on:** V2-05, V2-16, V2-17. **Change areas:** channel/idea backlog, release metadata, performance reporting.

Connect outcomes to topic, format, hook, title, thumbnail, and production effort. Provide review notes and follow-up ideas for creators to accept, rather than automatically changing presets or publishing.

Acceptance:

- Compare videos within relevant channel, format, and age windows, with sample size and data freshness visible.
- Distinguish correlation from causation; do not claim a title/thumbnail caused performance without appropriate evidence.
- Record packaging changes over time so observations can be interpreted against what viewers actually saw.
- A creator can save an evidence-linked follow-up idea into the existing backlog.
- No automatic provider spending, preset mutation, or publication results from a performance refresh.

**Data/rollout:** bounded read models and revision-linked editorial notes; no autonomous optimization engine.

### V2-19 — Release rehearsal and acceptance

**Depends on:** all earlier slices delivered or explicitly deferred with documented impact. **Change areas:** tests, this tracker, README, deployment/runbook documentation.

Run the [validation protocol](validation-and-rollout.md) against the selected long-form and Short workflows. Inspect real outputs and measure the same production outcomes as the baseline.

Acceptance:

- Critical browser journeys, relevant database invariants, type checking, lint, formatting, and production builds pass on the release candidate.
- Revision, draft recovery, failed-job recovery, interrupted upload, and source-to-Short compatibility scenarios have recorded evidence.
- A controlled private YouTube release verifies live account capabilities; publish or schedule publicly only under the user's explicit release instruction.
- Record migration/backfill/deployment state, residual external steps, measured outcomes, and any failed target honestly.
- Creator review confirms the chosen formats are usable for recurring production; deferred features and their consequences remain visible.

## Decisions before dependent work

Record resolutions in the tracker: representative channel formats (V2-00), asset compatibility/binding design (V2-01), recovery retention policy (V2-02), channel/preset snapshot shape (V2-04/05), supported YouTube scopes and scheduling behavior (V2-09/10), alignment provider and cost (V2-12), media/mix scope (V2-13/14), and analytics access/metric definitions (V2-17). These are implementation checkpoints, not requests to block this documentation task.
