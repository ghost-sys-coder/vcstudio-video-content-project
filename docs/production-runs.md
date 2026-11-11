# Production runs

Created 2026-11-11. Status: migration applied to production, worker `20261111.1` deployed, both variables set in Vercel production/preview and Trigger.dev; `ENABLE_PRODUCTION_RUNS=false` everywhere and the web code is not yet released.

## What a run is

A production run carries one still-image project from wherever it stands to a draft release package without a person clicking through each stage. It is started from the project **Overview** page by an owner or editor, runs inside one durable Trigger.dev task, and stops at the release package for a human review. Nothing is confirmed, scheduled or published by a run.

The run owns no production state. Every stage is started through the same server-side service a creator's own click calls (`startScriptGeneration`, `startApprovedSceneAnalysis`, `startBulkSceneImageGeneration`, `startSceneAudioGeneration`, `startVideoRender`, `startTitleGeneration`, `startThumbnailGeneration`, `saveReleasePackageDraft`), so budgets, reservations, idempotency, rate limits and audit apply exactly as they do by hand. The run keeps only its cursor (stage and paid attempts per stage), its frozen policy, the ids of the rows it created, and an append-only history.

## Stages and gates

| Stage   | What the run does                                                                        | Deterministic gate before acceptance                                                                                               |
| ------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Script  | Approves the draft, or generates one from the brief and approves it                      | Non-empty, within `MAX_SCRIPT_CHARACTERS`, at least 15 s, estimated length within 0.5–2× the brief target (warn outside 0.75–1.4×) |
| Scenes  | Runs scene analysis on the approved script and approves every scene                      | At least one scene, within `MAX_SCENES_PER_PROJECT`, every scene has narration and a visual; warns on 180+ word scenes             |
| Images  | Generates one image per scene at the project size and approves each                      | Generation succeeded, file stored, decoded size equals the requested size                                                          |
| Audio   | Generates narration with the chosen voice and approves each clip                         | Succeeded, file stored, measured length within 0.4–2.5× the estimate for the words (warn outside 0.65–1.6×), not mostly silence    |
| Render  | Renders the project's own aspect ratio with captions                                     | Render succeeded                                                                                                                   |
| Release | Generates titles, description and tags, a text-free thumbnail, and saves a draft package | Always a human review                                                                                                              |

A gate that **fails** stops the run (`held`) with the measured reasons. A gate that **warns** is accepted in `auto` mode and the warning is recorded. Every gate result is stored in `production_run_gate_results` with the numbers behind it, whether or not the run acted on it; this is the evidence the improvement roadmap asks for before autonomy widens.

The gates cannot see a picture or hear a voice. Garbled text in an image, a wrong character count, or a mispronunciation pass these gates. A model-backed visual and transcription check is the next increment and is deliberately not faked.

## Policy

Frozen onto the run when it starts (`lib/production-runs/production-run-policy.ts`):

- per-stage mode for script, scenes, images, audio and render: `auto` (accept when the gate passes) or `hold` (stop for a person even when it passes);
- image quality;
- voice preset (the workspace default when none is chosen);
- the most the run may commit in total, never above the project budget and at most `$100`;
- how many paid attempts a stage gets before the run holds (one retry by default, two attempts at most).

## Spending

Before every paid start the run compares the estimates it has already caused against its ceiling (`lib/production-runs/run-budget.ts`) and holds with a `budget_refused` event when the next step would pass it. Each stage still reserves against the project, daily and monthly workspace budgets through the existing money-safe commands. The run counts an attempt before calling a service, so a crash after the call cannot produce an unbounded retry.

## Holding, resuming, cancelling

- **Held**: a gate failed, a stage ran out of attempts, a stage service refused, or the policy says the stage waits. The reason is shown on the Overview page. A held run still owns the project: fix the stage by hand, then **Resume**; the run re-reads the project and continues from the same stage.
- **Cancel**: allowed while queued, running or held. Work already dispatched (an image batch, a render) carries on under its own cancellation controls; the run stops starting and approving anything.
- **Ready for review**: the run saved a draft release package. Confirm it against the render on the Publish tab, answer the platform declarations, and schedule.
- One open run per project is enforced by a partial unique index, not by the UI.

## Worker

`trigger/production-run.ts` on the `production-orchestration` queue (concurrency 2, one worker per project via `concurrencyKey`). It claims the run, then loops: plan one step from the database, carry it out, continue or `wait.for` 20 seconds. Waits are checkpointed, so an idle run costs no compute and no schedule slot. After four hours in one session the run holds with a resume prompt. A crashed worker marks the run failed via `onFailure`; nothing further is started.

## Data

Migration `20261111140314_production_runs`: `production_runs`, `production_run_events`, `production_run_gate_results`, enums `production_run_status` and `production_run_stage`, and five `audit_action` values (`production_run_started|held|ready|failed|cancelled`).

## Environment

| Variable                                | Where          | Default | Purpose                                                      |
| --------------------------------------- | -------------- | ------- | ------------------------------------------------------------ |
| `ENABLE_PRODUCTION_RUNS`                | web and worker | `false` | Master switch. Keep false until the worker task is deployed. |
| `PRODUCTION_RUN_DEFAULT_MAX_COST_CENTS` | web and worker | `500`   | Ceiling offered in the start dialog.                         |

## Release order

1. Apply the migration after owner approval. Done 2026-11-11.
2. Deploy the Trigger.dev worker (`npm run trigger:deploy`). Done 2026-11-11 as `20261111.1`.
3. Release the web app with the flag still false.
4. Set `ENABLE_PRODUCTION_RUNS=true` in `.env.trigger` first, then `.env.vercel`.
5. Run one project with every stage on `hold` to watch the gates, then widen.

## Not in this increment

Video-footage projects, animated-character projects are accepted but share the still-image path, model-backed quality gates, channel cadence (autopilot), confirming or scheduling the release, and MCP exposure of runs.
