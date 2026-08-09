# Application Improvement Implementation Roadmap

## Purpose

This document converts the August 2026 application review into an ordered,
implementation-ready roadmap. It covers reliability, security, product
activation, Marketing Studio maturity, media quality, and technical
sustainability.

Sentry and PostHog are intentionally excluded. They will be planned and
implemented separately later. This roadmap must not introduce either dependency
or their environment variables as an incidental part of another initiative.

## Current baseline

VCStudio already provides a broad production system:

- authenticated, workspace-scoped video production;
- cost-controlled AI text, image, audio, and rendering workflows;
- private R2 media storage;
- durable Trigger.dev processing and reconciliation for core billable work;
- Marketing Studio brand grounding, chat, skills, campaigns, research,
  schedules, approvals, and Social handoff;
- social publishing and scheduling across several providers;
- Google Business Profile synchronization and Marketing Studio grounding;
- workspace budgets, usage reporting, and audit history.

The next phase should improve confidence, discoverability, recovery, and
measurable output quality before adding broad autonomous behavior.

## Agreed language

- **Operational readiness**: whether the database, storage, worker tasks,
  provider configuration, API approvals, and feature flags required by a
  capability are actually usable in the current deployment.
- **Activity center**: one workspace-scoped inbox for operations that completed,
  failed, or require a human decision. It is not a second workflow engine.
- **Reconciliation**: bounded, idempotent comparison of PostgreSQL's
  authoritative state with provider or R2 state, followed by a safe repair or a
  visible exception.
- **Substantive edit**: a human revision large enough to indicate that generated
  output was not publish-ready. The exact deterministic threshold must be
  defined before quality metrics ship.
- **Autonomy**: deterministic, capped approval and handoff after the documented
  graduation evidence exists. It does not mean removing budgets, audit trails,
  or the Social publishing boundary.

## Architectural decisions

1. PostgreSQL remains authoritative for application and workflow state.
2. Trigger.dev performs recurring, media-processing, and long-running work.
3. Marketing Studio continues to hand approved content to Social; it does not
   gain a second publishing implementation.
4. Provider health checks must be read-only and must not consume billable
   provider operations merely to report readiness.
5. All new workspace-owned rows include `workspaceId` and are queried with both
   entity and workspace identifiers.
6. Every scheduled repair or inspection is bounded, idempotent, audited when it
   mutates state, and protected by an explicit concurrency limit.
7. Quality reporting distinguishes correlation from causation and does not
   promise that an observed content pattern will reproduce past performance.
8. No autonomous approval work begins until the quality-measurement phase has
   produced enough evidence to evaluate the existing graduation criteria.

## Delivery order

| Phase | Initiative                              | Primary outcome                                                | Depends on                                    |
| ----- | --------------------------------------- | -------------------------------------------------------------- | --------------------------------------------- |
| 1     | Critical browser journeys               | Prove real user workflows end to end                           | Existing simulator/provider seams             |
| 2     | Storage reconciliation                  | Repair leaked, abandoned, and missing assets                   | Existing reconciliation selectors             |
| 3     | Security headers                        | Establish a tested browser security policy                     | Known Clerk/R2/OAuth connection domains       |
| 4     | Operational readiness                   | Show whether deployed capabilities can actually run            | Worker heartbeat and safe provider probes     |
| 5     | First-value onboarding                  | Guide each role to a successful first outcome                  | Readiness results                             |
| 6     | Unified activity center                 | Consolidate review, completion, and failure attention          | Existing workflow read models                 |
| 7     | Recovery actions                        | Give every classified failure a valid next action              | Activity center taxonomy                      |
| 8     | Marketing quality metrics               | Measure review quality and cost per useful outcome             | Content revisions and publication history     |
| 9     | Marketing orchestration and digest      | Produce an honest recurring plan and summary                   | Quality metrics and readiness                 |
| 10    | Media inspection                        | Verify uploaded video/audio and enable recorded-audio lip-sync | Media-processing queue                        |
| 11    | Knowledge ingestion                     | Improve supported formats and long-document grounding          | Storage and reconciliation                    |
| 12    | Performance feedback                    | Learn from normalized publication outcomes                     | Provider analytics access and quality metrics |
| 13    | Animated-character refinement           | Improve the existing cutout system incrementally               | Recorded-audio analysis                       |
| 14    | Evidence-gated autonomy                 | Add deterministic capped auto-approval                         | Graduation criteria satisfied                 |
| 15    | Schema and documentation sustainability | Reduce change risk and documentation drift                     | Stable feature work above                     |

## Phase 1 — Critical browser journeys

### Goal

Add Playwright coverage for the cross-layer workflows that unit tests cannot
prove. Tests must run against an isolated test database and storage/provider
simulation configuration; they must never publish to real accounts or invoke a
billable provider.

### Scope

1. Add Playwright and scripts for local and CI execution.
2. Establish authenticated test-user and workspace fixtures without sharing
   production credentials.
3. Provide deterministic provider simulators for generation, OAuth callbacks,
   rendering completion, and social delivery.
4. Cover these journeys first:
   - sign in and first-workspace onboarding;
   - role-sensitive navigation and owner/editor/viewer permissions;
   - create project → save/approve script → analyze scenes;
   - generate/upload and approve image/audio → preview → render;
   - create/edit/delete/schedule/cancel a social draft;
   - Marketing approval → Social draft handoff;
   - Google Business OAuth callback → location selection → context preview;
   - authorization failure, provider failure, and budget refusal recovery.
5. Capture traces, screenshots, and video only on failure; ensure artifacts do
   not contain secrets or signed URLs.

### Likely areas

- `playwright.config.ts`
- `e2e/`
- `packages/test-utils/` or the existing test-utility layer
- provider simulation adapters
- `package.json`
- CI workflow configuration

### Verification

- Tests pass from a clean database fixture.
- No test reaches a real billable or publishing provider.
- Cross-workspace negative cases are included.
- Failed runs retain safe diagnostic artifacts.

## Phase 2 — Storage reconciliation

### Goal

Wire the existing stale-run and orphan-asset selectors into a durable,
concurrency-limited cleanup process.

### Scope

1. Inventory all R2 asset families, including newer marketing media,
   thumbnails, custom uploads, character poses, outpaints, and video exports.
2. Extend pure selectors where newer asset families are missing.
3. Add bounded repository queries with cursor pagination.
4. Add a scheduled Trigger.dev task that:
   - removes terminal-failed/cancelled objects that should not be retained;
   - marks successful rows whose R2 objects are missing;
   - expires abandoned two-phase uploads;
   - retries safe database cleanup after a confirmed object deletion;
   - never deletes a healthy historical generation merely because it is not
     currently approved.
5. Record an audit event for material deletion or repair.
6. Add a dry-run mode that reports candidate counts without mutation.
7. Add retention configuration only where a real retention decision exists;
   do not introduce a blanket delete-after-N-days policy.

### Data and configuration

A migration may be needed for reconciliation attempts, cursor/checkpoint state,
or missing-asset status. Any new batch size, age threshold, or feature flag must
be validated in the environment schema and documented.

### Verification

- Pure partition tests cover every asset family.
- PostgreSQL integration tests cover tenant isolation and idempotent repair.
- R2 adapter tests prove exact-key deletion and traversal resistance.
- Two overlapping sweeps cannot repair or delete an asset twice.
- Trigger.dev dev and production deployment is explicitly required.

## Phase 3 — Security headers

### Goal

Add an explicit, environment-aware browser security policy without breaking
authentication, media playback, uploads, OAuth, or the Remotion preview.

### Scope

1. Inventory every required origin for Clerk, R2, provider media, OAuth,
   application APIs, and local development.
2. Add:
   - Content Security Policy;
   - HSTS in production;
   - `Referrer-Policy`;
   - `Permissions-Policy` with camera/microphone allowed only where required;
   - `X-Content-Type-Options: nosniff`;
   - frame-ancestor protection.
3. Prefer nonce-based script policy if compatible with the current Next.js and
   Clerk integration. Do not weaken the policy with broad wildcards merely to
   silence violations.
4. Start with a report-only deployment if necessary, then enforce after known
   violations are resolved.
5. Ensure signed asset URLs and OAuth codes never appear in violation reports.

### Verification

- Unit tests validate header construction by environment.
- Browser journeys cover sign-in, microphone recording, upload, previews, and
  OAuth redirects with the policy enabled.
- Production headers are verified on representative public and authenticated
  routes.

## Phase 4 — Operational readiness dashboard

### Goal

Give workspace owners and deployment operators one truthful view of whether a
capability is configured, deployed, authorized, and recently healthy.

### Scope

1. Define a typed readiness result:
   `ready | degraded | blocked | disabled | unknown`.
2. Separate deployment-level checks from workspace-level checks.
3. Report:
   - feature-flag state;
   - migration/schema compatibility;
   - R2 configuration and a safe metadata-level probe;
   - Trigger task heartbeat and last scheduler completion;
   - stuck active-operation counts;
   - OAuth/provider configuration without exposing credential values;
   - provider authorization and expiry state;
   - Google Business last sync, error, and next scheduled sync;
   - publishing simulator/live mode;
   - remaining known approval or quota blockers.
4. Provide exact corrective guidance for owners while keeping deployment-only
   details restricted to appropriate operators.
5. Cache expensive checks briefly and rate-limit manual refresh.

### Data and configuration

Add a small task-heartbeat table if Trigger.dev execution cannot be queried
reliably without external coupling. Heartbeats must record task identity,
environment, last started/completed time, and safe outcome—not payloads or
secrets.

### Verification

- Credential values never cross the server/client boundary.
- A missing worker, expired token, disabled feature, and quota blocker each
  produce distinct states and actions.
- Editors/viewers see only the readiness information permitted by policy.

## Phase 5 — First-value onboarding

### Goal

Guide a new workspace to its first useful output without forcing every user
through every product area.

### Scope

1. Build role-aware tracks:
   - video production;
   - Marketing Studio;
   - social publishing.
2. Derive completion from authoritative data, not manually checked boxes.
3. Suggested milestones:
   - complete the brand profile;
   - configure a budget;
   - connect a publishing destination;
   - optionally connect Google Business Profile;
   - create the first project or marketing draft;
   - approve the first generated/uploaded asset;
   - complete the first render or publish.
4. Use readiness results to prevent sending users into a blocked flow.
5. Allow dismissal without hiding operational blockers.

### Verification

- Completion remains correct across refreshes and multiple members.
- Viewers receive an observation path rather than mutation prompts.
- No checklist action bypasses normal authorization or confirmation gates.

## Phase 6 — Unified activity center

### Goal

Create a workspace-scoped attention inbox without duplicating workflow state.

### Scope

1. Define normalized activity categories and severity:
   - review required;
   - completed;
   - failed;
   - partially failed;
   - integration attention;
   - budget/cap refusal;
   - scheduled action skipped.
2. Build the view from existing authoritative tables. Add a projection table
   only if query cost or heterogeneous pagination cannot be solved cleanly.
3. Include deep links to the exact project, content item, post target, render,
   integration, or schedule run.
4. Support filtering, bounded pagination, unread/acknowledged state, and role
   permissions.
5. Do not present a generic workspace success when one destination failed.

### Verification

- Activities never leak across workspaces.
- Deep links resolve to the exact failing or reviewable entity.
- Partial social failures retain destination-level detail.
- Acknowledging an activity does not alter workflow state.

## Phase 7 — Actionable failure recovery

### Goal

Map typed failures to valid, safe recovery actions.

### Scope

1. Establish a shared failure taxonomy covering validation, authorization,
   configuration, quota, budget, unsupported media, transient provider error,
   ambiguous provider outcome, and internal failure.
2. For every surfaced failure, provide only actions that are actually safe:
   - reconnect;
   - retry immutable input;
   - replace media;
   - open budget settings;
   - wait for quota reset;
   - resume from the last durable stage;
   - inspect the exact failed destination;
   - copy a safe support correlation identifier.
3. Never offer automatic retry for an ambiguous, possibly billed or possibly
   published operation.
4. Centralize user-facing error copy so web pages and activity items agree.

### Verification

- Exhaustive tests ensure every domain error has a presentation and action.
- Permanent failures do not show retry.
- Raw provider bodies, secrets, and signed URLs never appear in support detail.

## Phase 8 — Marketing quality metrics

### Goal

Measure whether Marketing Studio output is useful enough to justify greater
automation.

### Scope

1. Define substantive editing deterministically. Prefer normalized edit
   distance plus material field changes, with thresholds documented and tested.
2. Record or derive:
   - generated and reviewed item counts;
   - approval/rejection rate;
   - substantive-edit rate;
   - time to first review and approval;
   - rejection reasons;
   - duplicate-content frequency;
   - publication success by platform;
   - cost per approved and per published item;
   - prompt, skill, brand-context, and model version.
3. Build workspace dashboards and date-range comparison.
4. Preserve historical reproducibility when prompts or context versions change.
5. Exclude insufficient sample sizes from confident recommendations.

### Verification

- Metric definitions have fixture-based tests.
- Revisions cannot be attributed to another workspace or content item.
- Dashboard totals reconcile with source records.
- Empty and low-sample states communicate uncertainty honestly.

## Phase 9 — Marketing orchestration and weekly digest

### Goal

Complete the useful parts of Marketing Studio Slice 13 without autonomous
approval.

### Scope

1. Implement `social_media_manager` as orchestration over existing skills and
   content-item persistence, not a privileged publishing tool.
2. Produce a bounded weekly plan that respects brand context, selected Google
   Business facts, channel capabilities, schedule caps, and budget.
3. Add a weekly digest that reports even when nothing happened:
   - generated/reviewed/approved/published counts;
   - substantive edits and rejection reasons;
   - spend and cap/budget refusals;
   - scheduler skips and failures;
   - integration health and Google Business sync status;
   - upcoming scheduled work;
   - recommended human actions.
4. Persist digest generation and read/acknowledgement state so the documented
   graduation criterion can be measured.
5. Keep every result in review unless the existing assisted handoff rules allow
   it; do not implement autonomous approval here.

### Verification

- A no-activity week produces an honest digest.
- Duplicate weekly runs are prevented by a workspace/week idempotency key.
- Plans cannot exceed workspace/rule budgets or platform capability limits.
- Trigger.dev dev and production deployment is required.

## Phase 10 — Media inspection

### Goal

Move trust-sensitive audio/video inspection into the media-processing worker.

### Scope A: recorded audio

1. Inspect duration, container, codec, channels, and sample rate with FFprobe.
2. Generate a bounded amplitude envelope compatible with the existing
   character lip-sync contract.
3. Detect severe silence, clipping, and unusable duration; provide actionable
   review warnings rather than silently altering the recording.
4. Optionally calculate loudness normalization recommendations. Do not replace
   the user's recording without explicit consent.
5. Make recorded narration eligible for animated-character lip-sync after
   successful inspection.

### Scope B: uploaded video

1. Verify duration, dimensions, rotation, aspect ratio, codec, container, frame
   rate, and audio presence server-side.
2. Persist verified metadata separately from untrusted browser hints.
3. Evaluate compatibility against each selected platform before scheduling.
4. Route unsupported files to a clear remediation path; do not invoke FFmpeg
   from a web request.

### Verification

- Fixture media covers rotated video, variable frame rate, silent audio, bad
  containers, clipping, and malformed files.
- FFmpeg/FFprobe is always invoked with argument arrays.
- Worker retries cannot duplicate stored derivatives or usage events.

## Phase 11 — Knowledge ingestion

### Goal

Expand supported business knowledge while keeping grounding bounded,
inspectable, and resistant to prompt injection.

### Scope

1. Add PDF and DOCX extraction in a background task with justified,
   server-only dependencies.
2. Add transcript and representative-frame extraction for supported video when
   it materially improves marketing grounding.
3. Replace first-excerpt-only summarization with bounded chunk summaries and a
   final synthesis for long documents.
4. Preserve extracted chunks, checksums, source locations/pages, summary
   versions, and safe processing errors.
5. Add document freshness/expiration and reprocessing controls.
6. Show users exactly which documents and claims entered a brand-context
   snapshot.
7. Evaluate retrieval quality with a representative corpus before adopting a
   vector database; retain PostgreSQL full-text search until measured evidence
   shows it is insufficient.

### Verification

- Malformed and password-protected files fail safely.
- Cross-workspace object keys and document IDs are rejected.
- Prompt-like document instructions remain quoted data, never system policy.
- Context truncation remains visible and deterministic.

## Phase 12 — Performance feedback

### Goal

Connect published outcomes to content decisions without overstating causality.

### Scope

1. Confirm provider analytics access and review requirements per platform.
2. Define a normalized metric contract for impressions, views, watch time,
   retention, engagement, clicks, and conversions while preserving provider raw
   identifiers and definitions.
3. Synchronize analytics on bounded schedules with per-provider cursors and
   quota-aware backoff.
4. Attribute outcomes to publication target, title/caption, thumbnail, hook,
   format, prompt/context version, and publication time.
5. Present comparisons as experiments and correlations, not guarantees.
6. Do not merge Google Business listing facts with performance observations;
   keep their provenance distinct in storage and prompts.

### Verification

- Provider metric changes cannot silently corrupt normalized history.
- Deleted/revoked connections preserve historical non-secret analytics.
- Missing metrics and incomparable platform definitions are explicit.

## Phase 13 — Animated-character refinement

### Goal

Improve the existing deterministic cutout animation system before considering a
separate full motion-capture product.

### Scope

1. Expand pose types to include gestures, emotion variants, turned views, and
   pointing.
2. Add deterministic blink, gaze, entrance, exit, and speaker-transition
   behavior.
3. Add per-scene paths, depth ordering, and simple occlusion while keeping the
   timeline reproducible.
4. Provide a per-scene animation preview and approval state.
5. Use inspected recorded-audio amplitude envelopes for lip-sync.
6. Add safe bulk pose generation with cost confirmation and per-result review.

### Explicit exclusion

Camera-based realistic motion capture, rig retargeting, full 3D characters,
hand tracking, facial performance capture, and physics interaction are not an
incremental extension of this phase. They require a separate feasibility study,
provider/build decision, and rendering architecture.

### Verification

- Timeline output remains deterministic from immutable inputs.
- Missing poses degrade to a named fallback rather than breaking a render.
- New pose spend uses the existing budget and reservation rules.

## Phase 14 — Evidence-gated autonomy

### Entry criteria

Do not begin until the evidence in `docs/marketing/09-automation.md` can be
computed and has been satisfied, including publication volume, approval quality,
brand-safety history, spend stability, scheduler correctness, digest readership,
and a production-tested kill switch.

### Scope

1. Implement deterministic brand-safety checks for banned phrases, unsupported
   claims, regulated terms, platform limits, links, media eligibility, and
   recent duplicates.
2. Route every failed check to human review with the exact reason.
3. Cap auto-approval by workspace, rule, day, platform, and spend.
4. Make the kill switch effective before new work is claimed and disclose
   already-scheduled Social posts it does not cancel.
5. Keep video generation stopped at the approved cost gate unless a separately
   confirmed, per-video capped policy is introduced.

### Verification

- Every safety gate refuses independently in unit and integration tests.
- Overlapping schedules cannot exceed caps or publish duplicates.
- Switching to manual immediately stops new autonomous claims.
- No LLM judges its own output for approval.

## Phase 15 — Schema and documentation sustainability

### Schema modularization

Split the large schema into domain files while exposing one schema surface to
Drizzle:

- identity and workspaces;
- projects, scripts, and scenes;
- assets, generation, and rendering;
- publishing and social;
- Marketing Studio;
- provider integrations;
- usage, budgets, and audit.

This phase must be behavior-preserving. It should not generate a migration when
only TypeScript module boundaries change.

### Documentation maintenance

1. Move dated historical detail from the README into a changelog archive.
2. Keep README setup, environment, current capabilities, limitations, and
   deployment instructions concise and current.
3. Add a generated or validated feature-status matrix.
4. Mark design documents implemented, superseded, or future.
5. Add checks that environment variables agree across:
   - Zod environment schemas;
   - `.env.example`;
   - Vercel/Trigger runtime documentation;
   - feature readiness checks.
6. Correct known stale statements, particularly older Marketing Studio
   descriptions that say implemented chat skills or deferred tools are absent.

### Verification

- Typecheck and build produce no schema import cycles.
- Generated migration output is empty for the module-only schema move.
- Documentation links and environment-contract checks pass in CI.

## Cross-cutting requirements

Every phase must follow `AGENTS.md` and additionally satisfy these constraints:

### Authorization and tenancy

- Resolve the authenticated user and active membership server-side.
- Scope every workspace entity query by `workspaceId`.
- Add explicit owner/editor/viewer tests for new routes and actions.
- Treat authentication and authorization as separate checks.

### Cost and provider safety

- Estimate, reserve, and reconcile every billable provider operation.
- Do not add automatic retries where a provider may already have billed or
  published.
- Preserve provider request IDs and safe error categories.
- Make costs visible before confirmation where the operation is user-initiated.

### Background work

- Keep long-running processing out of Next.js requests.
- Use explicit queues and concurrency limits.
- Persist state in PostgreSQL before dispatch.
- Use idempotency keys containing workspace, entity, operation, input version,
  provider/model, and relevant options.
- Add reconciliation for any new active workflow state.

### User experience

- Provide loading, empty, success, partial-success, and actionable error states.
- Prevent duplicate submissions and preserve recoverable user work.
- Support keyboard navigation and visible focus.
- Avoid creating a second interface for an action that already has one
  authoritative owner.

### Security

- Keep secrets and sealed tokens server-side.
- Validate external input with Zod.
- Use private storage and short-lived signed URLs.
- Sanitize filenames and object keys.
- Never log signed URLs, provider tokens, OAuth codes, raw sessions, or uploaded
  document contents.

## Definition of done for each initiative

An initiative is complete only when:

1. The requested behavior exists and the documented exclusions remain excluded.
2. Authorization and workspace isolation are enforced.
3. External input and provider responses are validated.
4. Failure and recovery behavior is explicit.
5. Relevant unit tests pass.
6. Relevant PostgreSQL integration tests pass.
7. Critical browser journeys are added or updated.
8. Formatting, linting, and strict TypeScript checks pass.
9. The production build passes.
10. New migrations are generated, reviewed, applied, and verified when needed.
11. Trigger.dev tasks are deployed to development and production when needed.
12. `.env.example`, environment validation, and runtime deployment files agree.
13. README and the relevant focused documentation are updated.
14. `git diff` is reviewed for unrelated changes and security regressions.

## Deferred items

The following are intentionally outside this roadmap or require a separate
decision:

- Sentry integration;
- PostHog integration;
- billing and subscription plans;
- bring-your-own provider keys;
- direct TikTok posting beyond the approved inbox workflow;
- paid advertising API campaign management;
- full realistic camera motion capture and 3D retargeting;
- autonomous operation before graduation criteria are measurable and met.

## Recommended first implementation slice

Begin with Phase 1 browser-test infrastructure and a narrow first journey:

```text
authenticated owner
→ create workspace fixture
→ create project
→ save and approve script
→ run simulated scene analysis
→ verify scenes appear inside the same workspace
```

This establishes the reusable authentication, database, provider-simulation,
and cleanup foundation needed by nearly every later phase. Phase 2 storage
reconciliation should follow immediately after that foundation is stable.
