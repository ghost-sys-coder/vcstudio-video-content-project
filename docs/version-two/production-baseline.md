# V2-00 production baseline

Started: 2026-09-08. Status: technical fixtures implemented; Money Made Clear selected; measured creator walkthrough pending. This record is not evidence that V2-01 revision safety is fixed.

## Evidence boundaries

- The local application at `http://localhost:3000/app/projects` was inspected through Chrome and presented the Clerk development sign-in screen. No authenticated production walkthrough was performed.
- The existing development server was reused. An attempted second `npm run dev` exited because that server already owned the workspace; the existing server was not stopped.
- The existing Playwright setup has a configured development owner, but its current journey covers project creation/settings/deletion rather than complete production. It was not executed for this slice.
- The tests below execute production timeline, caption, Short, render-snapshot, and scene-edit logic with synthetic data. Scene command persistence is mocked: they do not prove database atomicity or live provider behavior.
- No database, R2, OpenAI, Trigger.dev, or YouTube operation was performed by the new tests. Fixture object keys are inert strings; no MP4 or speech recording was produced.

## Representative format decisions

The creator selected **Money Made Clear** on 2026-09-08. The [confirmed channel brief](money-made-clear.md) is authoritative for the first production format: weekly 8-12 minute faceless finance education for US/UK adults approximately 20-45, with 20-40 scenes and 3-5 vertical clips. Mixed footage/stills, programmatic charts/graphics/callouts/screen examples, low-volume music, and selective effects are selected requirements. Animated characters are not a core requirement.

Two fixtures now have distinct purposes:

| Fixture             | Purpose                                          | Timing and outputs                                                                         | Evidence boundary                                                                                          |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Generic baseline v1 | Preserve the original revision-safety comparison | 40 x 12-second scenes + gaps = 489.75 seconds; one 45-second Short                         | Synthetic notebook content and inert media keys; unchanged from the initial baseline                       |
| Money Made Clear v1 | Exercise the confirmed channel structure         | 40 x 15-second scenes + gaps = 609.75 seconds; four distinct 45-second vertical candidates | Synthetic finance arithmetic; still/audio proxies only; required video/graphics/mix tracks not implemented |

The channel fixture records the requested editorial sequence and intended visual categories. It does not claim to generate footage or render programmatic financial graphics yet. Its fictional example uses neutral units; actual US/UK videos must identify jurisdiction and currency rather than combining them. Exact voice selection, provider/media access, creator time, cost, and external finishing steps await the walkthrough.

## Executable fixtures

Reusable factory: [version-two-production-fixture.ts](../../lib/test-utils/version-two-production-fixture.ts). Every call creates isolated synthetic records with valid UUID shapes and validates scene content through the current schema. It includes approved media identities, a caption correction, customized framing, and a derived Short definition. Do not seed these fixed IDs into a real workspace.

| Fixture                     | Evidence / steps                                                                                                                                                                    | Current outcome                                                                                                       | Future acceptance                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| B-01 Long-form assembly     | [production baseline tests](../../lib/test-utils/version-two-production-baseline.test.ts) assemble the 40-scene timeline and freeze a render snapshot                               | 489,750 ms and 14,693 frames; captions stay within scene bounds; serialized snapshot survives later source mutation   | Preserve these invariants through V2-01/12/13/14                                                        |
| B-02 Derived Short          | Same suite trims four existing scenes and reuses narration objects                                                                                                                  | 45,000 ms and 1,350 frames; edited caption retained; crossed cue emits warning                                        | Preserve identity, captions, and framing during compatible revisions                                    |
| B-03 Early-scene edit/no-op | [scene-revision characterization](../../db/commands/scene-revision-baseline.test.ts) invokes the actual `updateScene` with a mock database                                          | Both save types create 39 versions and reset 39 scene statuses to review; 38 downstream narration texts are unchanged | V2-01 must replace these characterization expectations with no-op/no-downstream-invalidation assertions |
| B-04 Failed generation      | Remove scene 7 image and scene 11 audio from the otherwise approved fixture                                                                                                         | Timeline blocks with the exact missing-image and missing-audio scene numbers                                          | Recovery targets only failed work and never hides partial failure                                       |
| B-05 Unsaved script         | In an isolated development project: save sample A, type sample B without saving, navigate away/reload, return; record what remains                                                  | Manual/browser execution pending; source audit indicates browser-only unsaved state                                   | V2-02 recovers B, handles stale revisions, and exposes save state                                       |
| B-06 Interrupted upload     | Use synthetic provider transport responses: accept a chunk/session, interrupt before final confirmation, retry against persisted state; separately simulate final confirmation loss | Fixture specification only; no interrupted YouTube upload test added or live upload attempted in this slice           | V2-09 persists/reconciles progress and does not duplicate publication                                   |

The B-03 result above records the original defect. V2-01 has since replaced the characterization assertions with no-op and single-scene revision checks; its delivery record in the [build tracker](build-tracker.md) contains current implementation and validation evidence. The other V2-00 measurements remain historical baseline evidence.

## Money Made Clear fixture extension

See [channel fixture](../../lib/test-utils/money-made-clear-fixture.ts) and [channel tests](../../lib/test-utils/money-made-clear-fixture.test.ts). Checks cover the seven-stage editorial structure, 609,750 ms / 18,293-frame long-form timeline, four separate 45-second vertical candidates retaining their original media, in-bounds captions, caption inclusion on/off, no character layer, and arithmetic consistency of explicitly synthetic financial values. These checks are not a real production walkthrough or financial fact verification.

## Commands and results

Executed on 2026-09-08:

- `npx vitest run lib/test-utils/version-two-production-baseline.test.ts db/commands/scene-revision-baseline.test.ts`: 2 files, 7 tests passed.
- `npx vitest run lib/test-utils/version-two-production-baseline.test.ts db/commands/scene-revision-baseline.test.ts lib/timeline lib/shorts lib/subtitles lib/render lib/publishing/providers/simulated-video-publish-provider.test.ts lib/domain/bulk-scene-image.test.ts`: 25 files, 141 tests passed. This includes the 7 new tests, not an additional 141.
- Formatting executed on the three new TypeScript files. Final repository check results are recorded in the build tracker.
- Money Made Clear extension: `npx vitest run lib/test-utils db/commands/scene-revision-baseline.test.ts lib/timeline lib/shorts lib/subtitles lib/render lib/publishing/providers/simulated-video-publish-provider.test.ts lib/domain/bulk-scene-image.test.ts` passed 146 tests across 26 files, including five new channel tests. TypeScript passed; lint reported zero errors and the existing unused `IDEA_PLATFORMS` warning. Formatting, local documentation links, and diff whitespace checks passed.

No live database integration, authenticated production journey, media render, or publishing verification has passed for V2-00 yet. Application build is not required for this test/documentation-only change; production modules, routes, configuration, and dependencies are unchanged.

## Creator walkthrough record

Create a separate record per observed run using the following table. All values are currently **Not measured**; do not substitute test execution duration, narration duration, or zero for hands-on time, provider waiting time, or actual cost.

| Stage                            | Hands-on minutes | Waiting minutes | Actual cost / source | Blocker / recovery | External step |
| -------------------------------- | ---------------- | --------------- | -------------------- | ------------------ | ------------- |
| Choose idea and brief            | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |
| Write/review/approve script      | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |
| Analyze and revise scenes        | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |
| Generate/upload/review images    | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |
| Generate/record/review narration | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |
| Captions and assembly review     | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |
| Render and inspect output        | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |
| Package and release              | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |
| Derive/review/release Short      | Not measured     | Not measured    | Not measured         | Not observed       | Not observed  |

Record run date, anonymized channel/format, video duration, creator, environment, and live/simulated mode. Pause the hands-on timer during queues or interruptions. Record prior asset spend separately from incremental regeneration. Keep exact private content and account identifiers out of committed records.

## Remaining work before V2-00 verification

1. Channel, audience, duration, cadence, visual style, and media requirements are confirmed in the Money Made Clear brief. Choose the exact voice and obtain source/media assets during the walkthrough.
2. Perform one authenticated representative production walkthrough and fill the measurement table with actual observations.
3. Record actual external finishing work. Phase 4 requirements are selected; verify their implementation and output quality as those slices ship.
4. Keep V2-00 In progress until these criteria are evidenced. Technical fixtures can inform V2-01 design without claiming the live baseline is finished.
