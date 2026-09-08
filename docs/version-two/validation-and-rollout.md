# Validation and rollout

Use this protocol alongside each slice's acceptance criteria. Record actual results in the [build tracker](build-tracker.md), including failures and checks not run.

## Production measures

Baseline values are unknown until V2-00. Targets below are proposed acceptance targets, not achieved results or promises. Confirm comparable formats and sample sizes before interpreting changes.

| Measure                            | Definition                                                                                                                                                 | Proposed target                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Hands-on minutes per release       | Active creator work from idea selection through release completion; exclude queue waits and idle browser time; report research/external editing separately | At least 25% lower median on comparable baseline and version-two videos, with no creator-assessed quality regression |
| Revision-induced regeneration cost | Actual incremental provider spend caused by revisions; separate necessary changed-content generation from avoidable invalidation                           | Zero automatic paid regeneration for untouched scenes in the revision fixture                                        |
| Blocked-video age                  | Time since an unresolved blocker first prevented the next required production step; distinguish waiting-for-review from technical failure                  | Every blocked video exposes the reason, age, and actionable recovery                                                 |
| Planned versus actual releases     | Releases completed within the agreed release window divided by releases due in that window; preserve reschedule history                                    | No silent missed release; creator sets cadence target after baseline                                                 |
| External finishing steps           | Required actions outside VCStudio after internal render/package approval                                                                                   | No unreported external step; reduce those supported by the connected account                                         |
| Draft/asset preservation           | Recovered edits and retained compatible approvals after revision/reload fixtures                                                                           | No lost user text or unrelated asset invalidation                                                                    |

Use at least three comparable releases per measurement period when feasible; label smaller samples exploratory. Match duration band, channel format, research complexity, and output quality. Track long-form and Shorts separately. Simulation can validate behavior, not channel growth or hands-on production improvement.

## Test gates for implementation slices

| Layer           | Required evidence                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure logic      | Vitest tests for compatibility, normalization, readiness, timing, state transitions, and metric definitions touched by the slice                              |
| Database        | Development-database integration tests for new constraints, tenant isolation, atomic updates, concurrent revisions, idempotency, and backfills                |
| Browser         | Playwright coverage for the user-visible behavior, error recovery, reload/navigation, role restrictions, and relevant keyboard paths                          |
| Worker/provider | Deterministic provider fixtures for partial failure, timeout, retry, cancel, and recovery; distinct controlled live verification for external capabilities    |
| Render          | Preview/worker parity, valid media inspection, representative visual/audio review, and old/new snapshot compatibility                                         |
| Repository      | Formatting, lint, strict TypeScript, relevant unit/integration tests, and production build when compilation/routing/configuration/database/deployment changes |

Use existing npm scripts: `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build`. Limit formatting to changed files when a repository-wide pass would rewrite unrelated user work. Run `npm audit` after dependency changes and `npm run env:check` after environment-placement changes. Consult root README for the opt-in database test setup; never run those tests against a production database.

For documentation-only changes, format/check changed Markdown and verify local links and tracker consistency. Application lint/typecheck/test/build results from the earlier audit are not new execution evidence and need not be rerun solely for Markdown changes.

## Required production scenarios

### A. Revision safety

1. Prepare a representative multi-scene project with approved media, edited captions, custom output framing, a saved Short, and a completed render.
2. Save a no-op, then change narration only, then visuals only in an early scene using separate fixture copies.
3. Verify only affected content/assets require review; later approvals remain usable and history remains immutable.
4. Inspect captions, framing, Shorts, cost estimates, and old/new renders. Include a concurrent-edit conflict and an ambiguous legacy asset binding.

### B. Draft recovery

1. Type script changes, navigate, reload, disconnect/reconnect the network, and recover after a simulated crash.
2. Edit the same draft in two sessions and resolve the conflict without silent overwrite.
3. Insert generated text while a draft is dirty; approve while autosave is pending.
4. Repeat relevant reload/conflict cases for release metadata and verify no cross-user/workspace local recovery leakage.

### C. Recurring channel workflow

1. Select a channel and format; create a video from a saved idea using inherited defaults.
2. Approve a script, reject a narration discrepancy, then accept a valid scene plan.
3. Generate or upload media, review a partial failure, retry only the intended work, and assemble a preview.
4. Verify the dashboard's next action and blocker counts at every stage and that a viewer cannot mutate state.
5. Change the channel preset and verify existing project snapshots do not silently change.

### D. YouTube release

1. Save a package with exact render, title, description, thumbnail, captions, audience, destination, and intended release time.
2. Reload and confirm all choices; revise the source and verify stale-package handling.
3. Interrupt upload; separately fail thumbnail or caption attachment after video creation.
4. Resume without duplicate upload and inspect each finishing step's persisted status.
5. Exercise cancel/reschedule and token expiration. Inspect the resulting private video in YouTube and record any unavailable account capability.

Public publishing and paid provider calls require the user's applicable authorization and explicit in-product consent. A plan or simulated fixture does not authorize a public release.

### E. Quality and Shorts

1. Review a factual script with a disputed/unsupported claim and confirm evidence sign-off behavior after edits.
2. Align captions for narration with pauses, names, another language, and a recorded deviation from the script.
3. Compare manual timing corrections in preview, subtitle export, and final video.
4. Where selected formats require them, inspect visual-shot boundaries, B-roll trim, narration levels, music fades/ducking, and imported-media rights notes.
5. Derive a Short, inspect hook/payoff and framing, and publish through its own package without regenerating unchanged media.

### F. Performance independence

1. Disable deployment and workspace Marketing Studio switches and confirm video-performance refresh still works while marketing-only work stays off.
2. Exercise expired/revoked tokens, unavailable permissions, quota errors, missing metrics, true zero observations, and repeated imports.
3. Confirm source/definition/time provenance, comparable age windows, and packaging revisions in reports.
4. Save a follow-up idea without triggering paid generation or automatic publication.

## Migration and release procedure

1. Identify legacy data and shared consumers before designing a schema change. Define expected handling for unassigned channels, incompatible assets, and old render snapshots.
2. Generate a new immutable migration; test fresh and upgraded development databases. Review tenant constraints, indexes, null/default behavior, and supported transaction APIs.
3. Dry-run bounded, restartable backfills. Report affected/ambiguous rows; never resolve ambiguity by silently regenerating assets or assigning a random channel.
4. Use additive schema and versioned contracts so the currently deployed app/worker can coexist during rollout. Record migration application separately from generation.
5. Deploy compatible web and worker versions in the documented order. Confirm task presence, queue limits, and scheduler ownership; prevent two sweepers from dispatching the same release or refresh.
6. Enable the slice for the internal production workflow, run its smoke scenario, and record actual deployment evidence. Feature flags are optional implementation choices, not predeclared environment variables.
7. Roll back application behavior or disable new dispatch if needed while retaining persisted releases, historical snapshots, usage records, and uploaded media. Cancel/reconcile active work deliberately; do not use destructive schema rollback as the default.

## Version-two completion gate

- Every slice is Verified or explicitly Deferred with rationale and impact; deferred scope is not counted as delivered.
- No unresolved draft-loss, cross-workspace access, unintended spending, duplicate-publication, or revision-invalidation defect remains in supported workflows.
- The representative long-form and Short journeys have current browser, database, worker, output-review, and controlled live-provider evidence.
- Required checks pass on the actual release candidate; skipped integration or live checks remain visible blockers to the corresponding acceptance criteria.
- Migration, backfill, web/worker deployment, and environment states are recorded separately.
- The creator has reviewed finished outputs and comparable production measurements; unmet efficiency targets are reported rather than hidden.
- Root README capabilities, limitations, setup changes, and dated major-change entries match the delivered behavior.
