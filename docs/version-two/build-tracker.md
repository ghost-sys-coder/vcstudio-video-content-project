# Version-two build tracker

Last updated: 2026-09-08.

Product implementation: **0 of 20 slices verified**. V2-01 is In progress with the first revision-safety increment. V2-00 is In progress: technical baseline fixtures are implemented; Money Made Clear is selected and a measured creator walkthrough remains pending. No version-two migration has been created/applied and no version-two deployment has occurred.

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

| ID    | Slice                           | Depends on                                   | Status      | Evidence / next action                                                                                |
| ----- | ------------------------------- | -------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| V2-00 | Formats and production baseline | None                                         | In progress | [Technical baseline](production-baseline.md); Money Made Clear selected; measured walkthrough pending |
| V2-01 | Revision safety                 | V2-00                                        | In progress | No-op/local revisions implemented; edited-scene asset compatibility pending                           |
| V2-02 | Recoverable script editing      | V2-01                                        | Not started | Specify autosave/conflict/recovery behavior                                                           |
| V2-03 | Script-to-scene fidelity        | V2-01                                        | Not started | Define narration normalization and discrepancy cases                                                  |
| V2-04 | Channel profiles                | V2-01                                        | Not started | Design additive channel identity and legacy assignment                                                |
| V2-05 | Formats and idea backlog        | V2-04                                        | Not started | Define versioned preset snapshots                                                                     |
| V2-06 | Production queue/readiness      | V2-01, V2-04, V2-05                          | Not started | Map existing authoritative state to blockers/next actions                                             |
| V2-07 | Guided workspace                | V2-02, V2-03, V2-06                          | Not started | Map representative journey and preserve deep links                                                    |
| V2-08 | Persistent release package      | V2-02, V2-04                                 | Not started | Define draft/snapshot and output/destination identity                                                 |
| V2-09 | YouTube release completion      | V2-08                                        | Not started | Verify scopes and design resumable finishing steps                                                    |
| V2-10 | Scheduling and calendar         | V2-06, V2-09                                 | Not started | Verify provider scheduling and current worker capacity                                                |
| V2-11 | Editorial evidence review       | V2-03, V2-05                                 | Not started | Define manual source and claim-review workflow                                                        |
| V2-12 | Speech-aligned captions         | V2-01, V2-07                                 | Not started | Evaluate timing fixtures and provider cost/access                                                     |
| V2-13 | Visual assembly                 | V2-01, V2-05, V2-07                          | Not started | Implement selected footage/stills and programmatic financial graphics                                 |
| V2-14 | Audio consistency/mix           | V2-01, V2-05, V2-13                          | Not started | Money Made Clear music bed and selective effects selected                                             |
| V2-15 | Derived Shorts                  | V2-08, V2-12, V2-13, V2-14                   | Not started | Extend existing editor against versioned media tracks                                                 |
| V2-16 | Production measurement          | V2-06, V2-10                                 | Not started | Reconcile metric definitions with available usage/events                                              |
| V2-17 | YouTube performance refresh     | V2-04, V2-10                                 | Not started | Remove video-only marketing gates and verify token refresh                                            |
| V2-18 | Performance-informed planning   | V2-05, V2-16, V2-17                          | Not started | Define comparable cohorts and evidence-linked ideas                                                   |
| V2-19 | Release rehearsal               | V2-00–V2-18 delivered or explicitly deferred | Not started | Execute validation protocol after dependent delivery                                                  |

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
- Remaining acceptance: narration/visual compatibility matrix and explicit asset bindings; edited-scene caption/framing reuse; accurate regeneration estimates; automatic preservation/rebasing of affected Shorts; authenticated editor review. These are still required before V2-01 is Verified.
- Migrations/backfill/dependencies/environment configuration: none. Integration used a temporary isolated database workspace and cleaned it up. Deployment: not deployed. Rollback: revert this increment; no schema rollback.
- Next action: finish explicit compatible media bindings before starting V2-02 or channel profiles. Creator hands-on savings remain unmeasured.

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
