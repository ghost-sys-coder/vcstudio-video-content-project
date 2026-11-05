# Video Studio and project footage

## Using the application

Open **Video Studio** in the application sidebar to create a clip without a
project. Choose a configured model, enter a prompt, attach ready library stills
when supported, and select the model's available output controls. Review the
signed estimate before starting. Results enter the private Social media library;
use the existing Social composer to attach them to a draft and preview publication.
Generation never publishes or schedules content automatically.

For a project, open a scene's **Video & visuals** tab and choose **Generate
footage**. The composer can animate the scene's approved still directly, use a
library still, or generate from text. Generation creates a library result; select
that result in the scene tab, save its framing/trim/loop settings, preview it and
approve the saved footage explicitly. Project settings supplies the default
visual type, and each scene can override it. A mixed project can retain stills in
some scenes and approved clips in others.

Project footage is muted and keeps existing narration and captions. Independent
generation can retain native model audio where supported. A scene clip shorter
than narration blocks rendering unless its saved selection explicitly permits
looping. Contain fitting preserves the entire frame; cover is an explicit crop.
Existing image-only renders keep their original snapshot contract.

## Providers verified on 5 November 2026

| Direct integration | Models                | Supported entry points                    | Configuration                        |
| ------------------ | --------------------- | ----------------------------------------- | ------------------------------------ |
| Google Gemini API  | Gemini Omni 1.1 Flash | Text, first/last frames, image references | `GOOGLE_AI_VIDEO_GENERATION_API_KEY` |
| Runway API         | Gen-4.5, Gen-4 Turbo  | Text on Gen-4.5; first frame on both      | `RUNWAYML_API_SECRET`                |
| Luma Agents API    | Ray 3.2               | Text, first/last frames, silent SDR       | `LUMA_AGENTS_API_KEY`                |

Integration does not establish account access. Unconfigured providers remain
visible but unavailable. Kling, Seedance, Wan, MiniMax and Google Vertex are not
exposed as working integrations. They require verified protocols, capabilities,
credentials and pricing before being added. No aggregator dependency was added.

Google duration is prompt-guided, so reservations cover its maximum ten seconds.
The low-cost 360p default and 720p have pinned rates; 1080p/4K remain unavailable
without validated pricing overrides. Removing native audio does not lower the
provider charge. Reference delivery uses private image bytes with explicit roles.
See [Google generation](https://aistudio.google.com/docs/omni) and
[pricing](https://aistudio.google.com/docs/pricing).

Runway uses its documented generation/task endpoints and per-second native model
rates. See [API](https://docs.dev.runwayml.com/api/) and
[pricing](https://docs.dev.runwayml.com/guides/pricing/).

Luma accepts 5/10-second text clips; anchored images use five seconds. Pricing
preserves its nonlinear duration tiers and labels the default $0.003/credit list
rate. Override both estimate rates and `creditUsdMicros` for a different account
contract. Unknown settled credits retain the reservation. See
[generation](https://docs.agents.lumalabs.ai/guides/videos/generation/),
[pricing](https://docs.agents.lumalabs.ai/guides/pricing/) and
[accounting](https://docs.agents.lumalabs.ai/guides/usage/).

## Configuration and cost controls

See [environment ownership](../environment-runtime.md). The deployment flag
defaults off. Keep the chosen keys and the same video limits in web and worker
configuration. No key reaches the browser. Reuse the existing R2, database,
signing, encryption, FFmpeg and FFprobe configuration.

Default limits are $1.50 per operation, $3 per UTC day and $15 total across
workspaces, in addition to existing workspace/project budgets. These limits count
actual costs plus pending reservations, including ambiguous provider submissions.
They are application boundaries, not provider balance readings. Up to two active
requests can be reserved; the on-demand worker runs one at a time.

The quote expires after ten minutes and binds user/workspace, current scene,
assets, model, pricing and a single-use quote ID. Start uses an idempotency key;
retrying that key returns the existing operation. Never start a second request to
recover an uncertain first submission. Resume checks the persisted provider job;
it cannot submit a second billable request. Queued cancellation releases the
reservation. Running cancellation/refunds are not promised.

History refresh is user initiated. There is no idle polling or new scheduled
sweeper. Existing recovery stays at 30 minutes, storage reconciliation at six
hours. Pending accounting blocks project deletion; settled project deletion
detaches video costs/history and preserves library originals. Scene-owned copies
and append-only selection history keep frozen renders reproducible.

## Release procedure

1. Run formatting, lint, TypeScript, unit/integration/browser tests, environment
   validation, production build and dependency audit. Providers are mocked.
2. Test the two generated migrations on a production clone. Compare counts and
   content fingerprints of existing projects, scenes, media, Social posts/targets
   and usage rows. Verify every project still defaults to images.
3. Apply only the reviewed video migrations through Drizzle, recording their
   original hashes in the existing ledger. Production's older history contains
   some already-present schema changes without name entries; an unrestricted
   `npm run db:migrate` currently attempts to replay them. Do not re-run or
   re-baseline those changes as part of this release.
4. Synchronize the new configuration, deploy the completed Trigger worker and
   web app, then verify private access and paused Marketing remain enforced.
5. At most one live Google smoke clip is authorized during this release, with a
   reviewed estimate no greater than $1. Persist its provider handle before
   polling and verify inspected output and actual accounting. Do not retry an
   ambiguous billable submission. No live posting is part of verification.

## Verification commands

```powershell
npm test -- --maxWorkers=2
npm run test:e2e:mcp
npm run env:check
npm run typecheck
npm run lint
npm run build
npm audit

# Optional actual local export, using installed Chromium and bundled Windows FFmpeg.
$env:VCSTUDIO_VERIFY_LOCAL_RENDER="true"
npx vitest run lib/render/mixed-video-render.integration.test.ts --maxWorkers=1
Remove-Item Env:VCSTUDIO_VERIFY_LOCAL_RENDER
```

The local render test generates synthetic media without provider calls and checks
actual decoded still/video frames, contain bars, looping and independent narration.
Some existing integration suites require their own isolated database configuration
and remain skipped in the default test run.

## Boundaries

This release creates short model clips, not arbitrary-length one-request films.
UGC avatars, voice cloning, provider video editing/extension, lip-sync and
Marketing automation remain subsequent features. Generation is not exposed through
MCP v1. Existing MCP import/reuse/publish behavior is preserved. Marketing Studio
remains paused, LinkedIn Pages remains on hold, and private access remains enabled.

## Production verification result (5 November 2026)

The web app and worker were released after both migrations passed on a production clone and production. Existing business rows were unchanged. The initial worker is 20261105.1; public landing/waitlist and private-route/MCP authentication checks pass.

The only live Google operation reached the provider and failed with `RESOURCE_EXHAUSTED`. Google returned no video and no usage totals. The application retains the 60-cent estimate until billing can be confirmed; it does not label it a paid charge or issue another billable request. Check the API project associated with `GOOGLE_AI_VIDEO_GENERATION_API_KEY` in [AI Studio rate limits](https://ai.dev/rate-limit) and its billing page. A credit balance does not establish model quota or available capacity. [Google rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits) describes resource-exhaustion responses. Live successful-generation verification remains outstanding; deterministic provider, transfer, inspection and actual local mixed-media render checks passed.

The isolated verification branch `br-weathered-sky-airuhtwg` is retained with five-minute auto-suspend; it is separate from production and contains only the migration-test changes.
