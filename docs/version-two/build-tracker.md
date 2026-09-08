# Version-two build tracker

Last updated: 2026-09-09.

Product implementation: **0 of 20 slices verified**. V2-01 implements local revisions, compatible media reuse, edit estimates and Short anchors. V2-02 implements autosave/recovery and atomic script approval; authenticated validation remains pending. V2-00 has technical fixtures and the Money Made Clear baseline, with a measured creator walkthrough still pending. Five version-two migrations are generated/applied to the configured database. No version-two web/worker deployment has occurred.

## Status rules

| Status        | Meaning                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| Not started   | No implementation work or acceptance evidence yet                                    |
| In progress   | Active implementation; record owner and next action                                  |
| Blocked       | Record the concrete blocker, dependent work, and resolution needed                   |
| In validation | Code exists, but acceptance, deployment, or live verification remains                |
| Verified      | All slice criteria and applicable checks are evidenced; deployment state is explicit |
| Deferred      | Explicit scope decision recorded with reason and user-visible consequence            |

Only Verified counts as completed. Deferred does not count as delivered. Do not use Verified for mock-only provider behavior that requires live acceptance. Record partial delivery under In progress or In validation, with remaining work identified.

## Slice register

Acceptance criteria and change areas are in the [implementation plan](implementation-plan.md). Dependencies here mirror that plan.

| ID    | Slice                           | Depends on                                   | Status        | Evidence / next action                                                                                      |
| ----- | ------------------------------- | -------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| V2-00 | Formats and production baseline | None                                         | In progress   | [Technical baseline](production-baseline.md); Money Made Clear selected; measured walkthrough pending       |
| V2-01 | Revision safety                 | V2-00                                        | In progress   | Local revisions, media reuse, estimates and Short rebasing implemented; authenticated validation remains    |
| V2-02 | Recoverable script editing      | V2-01                                        | In validation | Autosave, local recovery, conflict review and atomic approval implemented; authenticated validation remains |
| V2-03 | Script-to-scene fidelity        | V2-01                                        | Not started   | Define narration normalization and discrepancy cases                                                        |
| V2-04 | Channel profiles                | V2-01                                        | Not started   | Design additive channel identity and legacy assignment                                                      |
| V2-05 | Formats and idea backlog        | V2-04                                        | Not started   | Define versioned preset snapshots                                                                           |
| V2-06 | Production queue/readiness      | V2-01, V2-04, V2-05                          | Not started   | Map existing authoritative state to blockers/next actions                                                   |
| V2-07 | Guided workspace                | V2-02, V2-03, V2-06                          | Not started   | Map representative journey and preserve deep links                                                          |
| V2-08 | Persistent release package      | V2-02, V2-04                                 | Not started   | Define draft/snapshot and output/destination identity                                                       |
| V2-09 | YouTube release completion      | V2-08                                        | Not started   | Verify scopes and design resumable finishing steps                                                          |
| V2-10 | Scheduling and calendar         | V2-06, V2-09                                 | Not started   | Verify provider scheduling and current worker capacity                                                      |
| V2-11 | Editorial evidence review       | V2-03, V2-05                                 | Not started   | Define manual source and claim-review workflow                                                              |
| V2-12 | Speech-aligned captions         | V2-01, V2-07                                 | Not started   | Evaluate timing fixtures and provider cost/access                                                           |
| V2-13 | Visual assembly                 | V2-01, V2-05, V2-07                          | Not started   | Implement selected footage/stills and programmatic financial graphics                                       |
| V2-14 | Audio consistency/mix           | V2-01, V2-05, V2-13                          | Not started   | Money Made Clear music bed and selective effects selected                                                   |
| V2-15 | Derived Shorts                  | V2-08, V2-12, V2-13, V2-14                   | Not started   | Extend existing editor against versioned media tracks                                                       |
| V2-16 | Production measurement          | V2-06, V2-10                                 | Not started   | Reconcile metric definitions with available usage/events                                                    |
| V2-17 | YouTube performance refresh     | V2-04, V2-10                                 | Not started   | Remove video-only marketing gates and verify token refresh                                                  |
| V2-18 | Performance-informed planning   | V2-05, V2-16, V2-17                          | Not started   | Define comparable cohorts and evidence-linked ideas                                                         |
| V2-19 | Release rehearsal               | V2-00–V2-18 delivered or explicitly deferred | Not started   | Execute validation protocol after dependent delivery                                                        |

## Per-slice delivery record

### V2-00 — Formats and production baseline

- Owner: Codex; creator confirmed Money Made Clear and its format on 2026-09-08.
- Status: In progress. Started/last updated: 2026-09-08; not verified.
- Delivered: reusable 40-scene fixture, 45-second derived Short, caption/framing/render-snapshot checks, individual failure blockers, and characterization of the current scene-edit command. Manual draft-loss and interrupted-upload scenarios are specified but not yet executed.
- Evidence: [baseline record](production-baseline.md), [fixture](../../lib/test-utils/version-two-production-fixture.ts), [assembly checks](../../lib/test-utils/version-two-production-baseline.test.ts), [revision characterization](../../db/commands/scene-revision-baseline.test.ts).
- Architecture: test-only factory uses existing domain contracts; scene-command persistence is mocked. No production implementation changed and no real account data is copied into fixtures.
- Tests: new suite 7/7 passed; broader focused suite 141/141 passed across 25 files, including the new tests. Formatting executed. `npm run typecheck` passed. `npm run lint` completed with zero errors and the existing `IDEA_PLATFORMS` unused-variable warning in `packages/prompts/src/idea-generation.ts`. Database integration and authenticated production E2E were not run; this mock-backed baseline does not verify them. Production build not applicable to test/documentation-only changes.
- Remaining: authenticated creator walkthrough with hands-on/wait/cost measurements, exact voice/media selection, and output inspection. Channel and format-specific media decisions are resolved. No live render/provider/database acceptance claimed.
- Migrations/backfill/dependencies/environment changes: none. Deployment: not deployed; test/documentation only. Rollback: remove the added test/fixture files and baseline documentation if no longer needed; no data rollback required.
- Historical baseline: characterization reproduced the 39-scene invalidation defect. V2-01 has now replaced those assertions with no-op/local revision checks; see its delivery record below.
- Production impact: not measured. The creator walkthrough remains pending and does not block V2-01 engineering.

### V2-01 - Revision safety (first increment)

- Owner: Codex. Started / updated: 2026-09-08. Status: **In progress**, not Verified.
- Delivered: unchanged content produces zero writes; changed content versions only the target scene. Later scene IDs, approvals, media, caption keys and framing references remain untouched. Storyboard timing is projected from current durations without rewriting old versions. Copying the cast retains stage slots and the speaker flag.
- Persistence: one PostgreSQL statement gates the revision and cast copy on an optimistic, workspace/project-scoped claim. A competing save receives a conflict. No generation, usage reservation, or old render mutation is performed.
- Editor: explains the current save impact and separate generation confirmation, disables unchanged saves, and reports no-op success accurately.
- Shorts: legacy absolute ranges require review/resave after a source or preceding scene revision before rendering. This is deliberately conservative until explicit compatible bindings and relative clip timing exist; it does not claim automatic derivative rebasing.
- Evidence: [command](../../db/commands/save-scene-revision.ts), [command tests](../../db/commands/scene-revision-baseline.test.ts), [content/timing tests](../../lib/domain/scene-revision.test.ts), [PostgreSQL integration](../../db/integration/project-cast-postgres.integration.test.ts), [Short guard tests](../../lib/shorts/short-revision-safety.test.ts).
- Checks: formatting completed; TypeScript passed; lint passed with the existing IDEA_PLATFORMS warning. Focused suite: 91/91 tests in 18 files passed. Real database integration: 1/1 selected test passed, including two competing saves, rollback after a failed insert, tenant isolation, preserved history, copied staging, and downstream timing after a duration edit; two unrelated tests were filtered out. Initial sandbox connection failed with EACCES; network-enabled retry and fixture cleanup passed. Production build passed (61 static pages generated); Next emitted localstorage-file runtime warnings. Authenticated browser review was not executed.
- Remaining at the end of the first increment: compatible media bindings and derivatives, estimates, Short rebasing and authenticated review. See the second increment for current status.
- Migrations/backfill/dependencies/environment configuration: none. Integration used a temporary isolated database workspace and cleaned it up. Deployment: not deployed. Rollback: revert this increment; no schema rollback.
- Creator hands-on savings remain unmeasured. The next increment below implements compatible media bindings.

### V2-01 - Compatible media reuse (second increment)

- Owner: Codex. Updated: 2026-09-08. Slice status: **In progress**, not Verified.
- Delivered: narration-only edits preserve approved images and saved framing; visual-only edits preserve approved narration and caption overrides; estimated-duration edits preserve both. Mixed edits invalidate the corresponding media. Compatible bindings copy across repeated revisions without duplicating generation or usage records.
- Selection: native approved replacements win over inherited media at the same size. Pending replacements leave inherited media available. Stale cover framing and outpaints from replaced sources cannot keep the older source selected. Image detail and audio workspace expose reuse; old-version review mutations are blocked.
- Architecture: explicit `scene_revision_media` links are created inside the atomic revision statement, scoped to workspace/project/version with foreign keys. Original prompts, generation identity, billing history and previous versions remain unchanged. No guessed backfill or provider call occurs on save. This policy is channel/genre independent.
- Migrations generated/applied to configured database: `20260908113623_scene-revision-media`, `20260908114347_revision-media-cascade-order`, `20260908114509_revision-media-source-cleanup`. The latter migrations correct source-link deletion behavior found during real cleanup tests; applied migrations were not edited. Deployments must apply all three. Source deletion cascades removal of its reuse links.
- Evidence: [reuse repository](../../db/repositories/scene-revision-media.repository.ts), [compatibility tests](../../lib/domain/scene-revision.test.ts), [selection tests](../../db/repositories/scene-revision-media.test.ts), [PostgreSQL scenarios](../../db/integration/scene-media-upload-postgres.integration.test.ts), [render selection tests](../../lib/subtitles/resolve-scene-image.test.ts).
- Validation: four live PostgreSQL scenarios passed, including repeated revisions, native replacement, original-history preservation, cross-workspace lookup refusal, caption overrides, framing and workspace cleanup. A targeted duration-case rerun passed with historical image/audio review rejection assertions. Initial tests exposed a cleanup constraint failure; four exact temporary workspaces/users were verified and removed after correction. `npx vitest run` on the focused revision/media/fixture directories passed 112 tests in 22 files; the final targeted selection/compatibility/renderer run passed 18 tests in 3 files, including two additional renderer regression cases (these runs overlap). `npm run typecheck` passed after correcting a nullable test fixture. Formatting passed; full lint and final targeted lint passed with only the existing IDEA_PLATFORMS warning in the full run. Final `npm run build` passed and generated 61 pages after a network-enabled retry for Google Fonts; existing localstorage-file warnings remain. No live provider generation was tested.
- Browser: the available Chrome tab remains on Clerk sign-in; authenticated editor interaction was not verified. No real image/audio/video output was generated.
- Remaining slice acceptance: exact regeneration estimates before save; automatic compatible Short rebasing; authenticated editor/production walkthrough. The existing conservative Short guard remains active.
- Dependencies/environment variables: none. Backfill: none. Deployment: not deployed or pushed for this increment. Rollback: revert application changes while retaining the additive table/migrations; legacy queries remain usable. No binary assets or historical generations were rewritten.
- Next action: finish the remaining V2-01 estimates and Short preservation before V2-02. Production savings remain unmeasured.

### V2-01 - Edit estimates and Short anchors (third increment)

- Owner: Codex. Started: 2026-09-08; updated: 2026-09-09. Slice status: **In progress**, not Verified; this record supersedes the remaining engineering items in the second increment.
- Delivered: the scene editor reviews affected media and replacement estimates before an explicit save. It calls a read-only, authorized server action; estimates use current configured rates, the edited prompt and the original approved image quality/style/references. Speech estimates use normalized replacement narration. Uploaded/recorded assets, missing settings and narration beyond provider limits are marked unpriced. Changing a field clears the estimate; preview and recoverable request errors preserve uncontrolled form inputs. Saving never reserves usage or invokes a provider.
- Estimate scope: one replacement per affected approved scene image and narration track. Outpainting, re-rendering, retries and media not yet approved are explicitly excluded. Generation performs its own authoritative estimate and budget checks later. No guaranteed invoice or automatic replacement is implied.
- Shorts: new and explicitly resaved compositions capture source-relative trim offsets plus the approved audio generation identity from the server's validated timeline. The editor, preview and export use the same read-time projection. Earlier timing changes and source revisions with the same approved audio preserve clip content. Replaced audio, removed sources and trims outside the new duration require review. Applying trim edits selects the current source revision so reviewed clips can be saved again.
- Architecture: audio identity is a historical snapshot, not a foreign key or an asset-access capability; it remains available for comparison if the audio is removed. The source scene/version retain their existing tenant foreign keys. Original saved absolute ranges, generation records, costs and historical render snapshots are unchanged. Legacy clips have no guessed anchors and keep conservative review rules until explicitly resaved. Policies remain genre independent.
- Migration: generated, reviewed and applied `20260908204936_short-relative-anchors`; nullable columns plus a constraint enforcing complete anchors and positive ranges. No backfill, dependency, environment-variable or paid-provider changes. Deploy the web application only after applying the migration. Deployment/push: not performed for this increment. Rollback: retain the additive columns/migration and revert application changes; old code can read the original absolute ranges.
- Evidence: [anchor projection](../../lib/shorts/short-anchors.ts), [anchor tests](../../lib/shorts/short-anchors.test.ts), [estimate service](../../lib/scenes/scene-revision-estimate.ts), [estimate tests](../../lib/scenes/scene-revision-estimate.test.ts), [PostgreSQL persistence tests](../../db/integration/short-composition-postgres.integration.test.ts).
- Checks: `npx vitest run lib/shorts lib/scenes/scene-revision-estimate.test.ts lib/test-utils lib/schemas/short.test.ts lib/domain/scene-revision.test.ts db/commands/scene-revision-baseline.test.ts lib/render lib/costs lib/subtitles` passed 179 tests across 34 files. Final targeted estimate/anchor run passed 15 tests across two files, including four added edge cases (these runs overlap). `RUN_DATABASE_INTEGRATION_TESTS=true npx vitest run db/integration/short-composition-postgres.integration.test.ts` passed both live PostgreSQL tests with fixture cleanup, including anchor persistence, rejected partial anchors and cross-workspace update refusal. `npm run typecheck` passed. Full lint passed with zero errors and the existing IDEA_PLATFORMS warning; final changed-file lint passed. Prettier write/check and `git diff --check` passed. Final `npm run build` passed after the draft-preservation fix, including TypeScript and 62 generated pages; existing localstorage-file warnings remain. No billable provider or live output test was performed.
- Browser: runtime setup succeeded but returned no connected browsers. Authenticated editor/preview/export interaction was not executed. No real media was generated or inspected.
- Remaining: authenticated creator walkthrough and final release validation; measured production savings remain unverified. Next planned feature slice is V2-02 recoverable script editing, following the V2-01 review.

### V2-02 - Recoverable script editing and approval

- Owner: Codex. Started/updated: 2026-09-09. Status: **In validation**, not Verified. User authorized the next slice while V2-01 authenticated review remains outstanding.
- Delivered: one-second debounced autosave with visible status, manual retry and reconnect handling; typing continues while a save is in flight. Late responses update the saved base, never overwrite newer typing. A fifteen-second confirmation deadline ends a stalled UI request; it does not claim to cancel a possibly committed database operation.
- Local recovery: only text, base revision and timestamp are stored, keyed by application user/workspace/project/tab session. Up to twenty records survive for at most seven days. Reload/navigation offer restore/discard; stale recovered revisions enter explicit conflict review. Storage failures are visible. Explicit discard and application sign-out clear recovery. No tokens, signed URLs or session credentials are stored in these records. Browser/tab-session loss and cross-device recovery are not guaranteed.
- Editorial flow: generated script insertion is staged for review, preserving existing writing until explicit replacement. Conflicts display the local editor and newer server text, with explicit choices guarded by a fresh optimistic revision on the next write. Viewers cannot edit or approve, and archived/missing projects are refused by the new action.
- Approval: a single atomic PostgreSQL statement claims the expected draft revision, writes exact submitted text/statistics, supersedes the old approval and inserts an immutable approved version. Retrying a lost approval response resolves its existing snapshot. Version creation/restoration now use the same gated snapshot path; losing a concurrent claim cannot create an extra historical version. Existing approved-version history controls remain available when the editor is settled.
- Migration generated/reviewed/applied: `20260908214436_script-draft-snapshots`; nullable positive `source_draft_revision` with per-project uniqueness. No historical backfill or inferred revision identity. No dependencies, environment variables, provider spending or Trigger tasks added. Shared script-command callers retain their full version return shape.
- Evidence: [controller](../../lib/scripts/script-draft-controller.ts), [recovery](../../lib/scripts/script-recovery.ts), [server action tests](../../lib/scripts/script-draft-action.test.ts), [atomic command](../../db/commands/commit-script-version.ts), [PostgreSQL tests](../../db/integration/script-draft-postgres.integration.test.ts), [authenticated scenario](../../e2e/script-draft.authenticated.spec.ts).
- Validation: `npx vitest run lib/scripts lib/auth lib/policies lib/schemas/project.test.ts lib/domain/script-statistics.test.ts lib/domain/script-version-deletion.test.ts` passed **45 tests across 11 files**. `RUN_DATABASE_INTEGRATION_TESTS=true npx vitest run db/integration/script-draft-postgres.integration.test.ts` passed **3/3** with fixture cleanup, covering exact/idempotent approval, approval replacement, competing claims, stale writes, tenant scoping and atomic restore. `npm run typecheck` passed; final `npm run build` passed including TypeScript and 62 generated pages. Full lint passed with only the existing IDEA_PLATFORMS warning; final targeted lint passed. Prettier write/check and `git diff --check` passed after correcting two test-file formatting discrepancies. Existing build localstorage-file warnings remain. No live provider calls or browser-output verification were performed.
- Browser: one connection setup attempt timed out after five seconds and was terminated; no retry loop. Authenticated Playwright scenario is authored but unexecuted. No live production walkthrough, generated media or measured creator savings are claimed.
- Deployment/push: not performed. Apply the migration before web/worker rollout because script version rows gained a field and shared version commands changed. Rollback: revert this increment while retaining the additive migration/column; historical content and original versions remain intact.
- Next action: authenticated workflow review, then V2-03 script-to-scene fidelity. Keep V2-01/02 validation limitations visible until exercised.

Copy this template below for each slice when work begins. Link commits/PRs and repository evidence rather than pasting secrets, signed URLs, raw credentials, or private channel content.

```markdown
### V2-XX — Title

- Status:
- Owner:
- Started / last updated / verified date:
- Scope delivered:
- Acceptance criteria met (reference plan criteria):
- Remaining criteria / next action:
- Architectural decisions and rationale:
- Changed files / commit or PR:
- Commands executed and exact results (pass/fail/skip):
- Browser/output review evidence (simulated or live):
- Database migrations: identifiers; generated/applied; target environment:
- Backfill: dry-run result, applied state, unresolved legacy rows:
- Dependencies and environment variables added/changed: none or exact names:
- Deployment: web/worker versions and environment; not deployed if applicable:
- Rollback or disable procedure:
- Known limitations / external finishing steps:
- Measured production impact:
```

## Decision log

| Date       | Scope            | Decision                                                                                                           | Status / consequence                                                   |
| ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 2026-09-08 | Entire plan      | Prioritize recurring YouTube production and preserve current architecture                                          | Planning baseline; no implementation authorized by this document alone |
| 2026-09-08 | Marketing Studio | No Marketing Studio feature improvements; preserve shared-service compatibility                                    | Video analytics independence remains in scope                          |
| 2026-09-08 | Delivery         | Start with baseline and revision safety; require evidence before completion                                        | All implementation slices Not started                                  |
| 2026-09-08 | V2-00            | Creator selected Money Made Clear; weekly 8-12 minute faceless finance with 3-5 clips and mixed/programmatic media | Resolved; measured walkthrough remains pending                         |
| Pending    | V2-12            | Alignment implementation and paid-provider budget                                                                  | Evaluate fixtures before provider selection                            |
| Pending    | V2-09/10/17      | Account scopes, supported release/analytics capabilities                                                           | Verify official docs and actual account access during implementation   |

## Money Made Clear extension

- Creator decision: [confirmed channel brief](money-made-clear.md); faceless weekly 8-12 minute long-form, 3-5 distinct vertical clips, mixed footage/stills, programmatic financial graphics, low-volume music/selective effects. Animated characters are not core scope.
- Technical delivery: test-only channel profile/visual manifest, a roughly ten-minute 40-scene fixture, and four 45-second candidates. The existing generic fixture remains unchanged by default.
- Required roadmap scope added: V2-13 programmatic charts/tables/callouts/screen examples and inspected video; V2-14 music and selective effects; V2-15 3-5 distinct clips and vertical graphic reflow for existing platform destinations.
- Verification: `npx vitest run lib/test-utils db/commands/scene-revision-baseline.test.ts lib/timeline lib/shorts lib/subtitles lib/render lib/publishing/providers/simulated-video-publish-provider.test.ts lib/domain/bulk-scene-image.test.ts` passed 146 tests across 26 files (five additional Money Made Clear tests). `npm run typecheck` passed; `npm run lint` completed with zero errors and the existing `IDEA_PLATFORMS` warning. Prettier check, 43 local documentation links, and `git diff --check` passed. No database, provider, generated media, migration, environment, dependency, or deployment change. Database integration, live production walkthrough, and rendering were not run; production build is not applicable to these test/documentation-only changes.
- Limitation: the production renderer still executes still/audio proxies; this manifest is not shipped mixed-media support. V2-00 remains In progress pending a measured walkthrough.

## Change log

- 2026-09-08: Started V2-00 with executable synthetic production fixtures and current scene-edit characterization. Seven new tests passed; live creator measurements and channel choices remain pending. No product behavior or database state changed.

- 2026-09-08: Created version-two plan, slice register, and validation protocol; linked from root README. Documentation only. Audit-era test results are historical context, not completion evidence for any new slice.
