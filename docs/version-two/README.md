# Version two: YouTube production

Created: 2026-09-08. Status: V2-00 baseline and V2-01 revision safety in progress. The first revision-safety increment is implemented; edited-scene media compatibility remains pending.

## Objective

Make VCStudio a dependable internal production tool for running recurring YouTube channels: choose a video, produce and revise it safely, publish a complete release, and use results to inform the next video. Optimize for finished videos and creator time, rather than the number of generated assets or available features.

## Documents

The [production baseline](production-baseline.md) contains the first executable fixtures, observed technical results, and the pending creator walkthrough record.

The first channel is [Money Made Clear](money-made-clear.md): one weekly 8–12 minute faceless finance video with 3–5 vertical derivatives, mixed footage/stills, programmatic graphics, and a restrained audio mix. Its media requirements are selected for V2-13–V2-15; a live measured walkthrough is still pending.

| Document                                            | Purpose                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [Implementation plan](implementation-plan.md)       | Ordered slices, dependencies, architecture, acceptance criteria, and expected change areas |
| [Build tracker](build-tracker.md)                   | Authoritative status for each slice, delivery evidence, decisions, and completion records  |
| [Validation and rollout](validation-and-rollout.md) | Test gates, representative production runs, migration safety, and outcome measures         |

The tracker is the only source of implementation status. Checklists in the plan define acceptance, not a second progress ledger. Update the tracker and root README in the same change that delivers a slice. A written plan, existing related feature, or passing mock test does not mean a slice has shipped.

## Scope

- Protect existing scripts, media, approvals, and render history during revision.
- Establish channel profiles, reusable formats, and a guided production queue.
- Complete the YouTube release package and scheduling workflow.
- Improve editorial verification, caption timing, and format-specific video assembly.
- Connect production effort and publication outcomes to future planning.

Marketing Studio improvements are excluded. Existing non-YouTube publishing and Marketing Studio behavior must remain compatible when shared services change. Moving shared video-performance scheduling out of a Marketing Studio dependency is in scope; redesigning Marketing Studio analytics is not.

Do not expand SaaS billing, add more publishing platforms, build a general-purpose video editor, or add autonomous publishing as part of this plan. Do not restructure the entire repository. Use the existing root Next.js application, `db/`, `lib/`, `trigger/`, `remotion/`, and `packages/prompts/` layout.

## Audit basis and retained foundations

This plan follows the source audit discussed on 2026-09-08. It is not evidence of a live production run. Recheck implementation before each slice; older roadmap completion claims do not prove these acceptance criteria.

| Audit finding                                                                                                     | Evidence in current repository                                                                                                             | Planned response    |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| Scene edits create new versions for the edited and subsequent scenes, while media lookup follows current versions | [scene commands](../../db/commands/scene-commands.ts), [subtitle context](../../lib/subtitles/subtitle-workspace-details.ts)               | V2-01               |
| Script and publication draft edits depend on browser state                                                        | [script editor](../../components/projects/ScriptEditor.tsx), [publish panel](../../components/publish/PublishToPlatformPanel.tsx)          | V2-02, V2-08        |
| Projects lack channel production identity and reusable format snapshots                                           | [schema](../../db/schema.ts), [publishing selection](../../lib/publishing/publishing-selection.ts)                                         | V2-04, V2-05        |
| Navigation and dashboard emphasize assets rather than the next production action                                  | [project header](../../components/projects/ProjectHeader.tsx), [dashboard](../../db/repositories/dashboard.repository.ts)                  | V2-06, V2-07        |
| Thumbnail creation is disconnected from upload; direct YouTube metadata lacks several release controls            | [publishing schema](../../lib/schemas/publishing.ts), [YouTube provider](../../lib/publishing/providers/youtube-video-publish-provider.ts) | V2-08 through V2-10 |
| Factual accuracy and narration preservation rely on prompt instructions                                           | [script prompt](../../packages/prompts/src/script-generation.ts), [analysis worker](../../trigger/scene-analysis.ts)                       | V2-03, V2-11        |
| Captions use proportional text timing; assembly has one image and narration per scene                             | [subtitle track](../../lib/subtitles/subtitle-track.ts), [render snapshot](../../lib/render/render-timeline-snapshot.ts)                   | V2-12 through V2-15 |
| Video performance has limited live metrics and depends on Marketing Studio scheduling                             | [performance sync](../../trigger/publication-performance-sync.ts), [sweeper](../../trigger/marketing-schedule-sweeper.ts)                  | V2-16 through V2-18 |

Retain workspace authorization, private R2 storage, usage reservations, bounded retries, bulk generation, selective review, manual media, immutable prompts, and frozen render snapshots. Extend existing publishing and analytics services rather than creating competing systems.

## Delivery sequence

| Phase                 | Slices      | Exit outcome                                                                              |
| --------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| 0. Establish evidence | V2-00       | Representative formats and production baseline recorded                                   |
| 1. Protect work       | V2-01–V2-03 | Revisions and draft recovery are safe; approved narration survives scene analysis         |
| 2. Repeat production  | V2-04–V2-07 | Channel defaults and guided production remove repeated setup and navigation               |
| 3. Complete releases  | V2-08–V2-10 | Saved YouTube packages, resumable finishing steps, and explicit schedules                 |
| 4. Improve quality    | V2-11–V2-15 | Evidence review, aligned captions, and the editing primitives required by actual formats  |
| 5. Learn and validate | V2-16–V2-19 | Measured production outcomes, usable performance feedback, and verified release readiness |

Begin with V2-00 and then V2-01. Capture baseline measurements manually first; analytics implementation must not delay revision safety. Phase 4 media scope is selected from actual channel formats during V2-00. Deferred format features stay explicitly deferred in the tracker.

## Success measures

Track hands-on minutes per released video, revision-induced regeneration cost, blocked-video age, and planned versus actual releases. Measure published-video quality separately from workflow speed. Definitions and proposed targets are in [validation and rollout](validation-and-rollout.md); no improvement is claimed until comparable production evidence exists.

## Relationship to existing documentation

[The earlier application roadmap](../application-improvement-roadmap.md) and [original phase specifications](../phases/phase1.md) remain historical context. Version-two IDs are independent of their phase numbers. This folder governs the new YouTube production improvements; it does not mark older initiatives complete or alter Marketing Studio plans.
