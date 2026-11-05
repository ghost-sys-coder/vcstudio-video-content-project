# Video generation: project production and direct creation

Status: In progress on `feat/video-generation-studio`, based on `703348c`.

## Authorized objective

Build both video-generation experiences with as many documented, available model
integrations as practical. Keep the product consistent with VCStudio's premium
production interfaces. Projects must support mixed still images and video, with
a project default and scene overrides. Direct generation must not require a
project, script or scene. Reusable assets and native audio prepare the foundation
for future UGC; Marketing Studio remains paused.

The user authorized implementation in isolation and asked for questions before
starting. The user subsequently authorized production release and supplied the
dedicated `GOOGLE_AI_VIDEO_GENERATION_API_KEY` in local `.env`, reporting $20 of
Google credit and asking that it be used sparingly. Project narration is the
default; direct generation supports optional native audio. Verification uses
mocks apart from at most one small live Google smoke test capped at $1 after
checking current pricing. Do not spend the remaining credit on test batches.

## Terminology and product decisions

- **Project production:** script/scenes, scene review, generated or imported
  footage/stills, narration, captions and final assembly.
- **Video Studio:** direct prompt/asset-to-video jobs owned by a workspace,
  independent of project creation. Results enter the private library and may be
  attached to a Social draft or a scene later.
- **Mixed media:** each scene can inherit the project's default or explicitly
  select an image/video. A pending, rejected, stale or missing video cannot be
  presented as approved footage or silently replaced during final rendering.
- **Provider availability:** integrated/configured/accessible are separate facts.
  Catalog entries do not prove account access. Retired models cannot be started.
- **UGC foundation:** reference assets retain roles and provenance; audio is an
  explicit output choice. Avatar, voice-cloning and marketing automation are
  later workflows, not implicit extra work in this release.

## Architecture

1. Shared Zod contracts live in `@studio/contracts/video`. Model capabilities
   constrain modes, media roles, shape, duration, resolution, frame rate, seed
   and audio. UI and server validate the same combinations.
2. A workspace-owned durable generation record supports a direct target or an
   optional, revision-protected scene target. Historical scene generations and
   render snapshots remain readable.
3. A narrow common provider interface delegates to explicit official API
   adapters. Models remain data; protocol differences stay in adapters. Do not
   expose arbitrary URLs, shell/SQL execution or provider method invocation.
4. A signed, expiring quote freezes the request, asset identities, model
   capability/rate version and maximum reservation. A separate explicit action
   starts the generation with an idempotency key. Reusing a key with changed
   inputs conflicts. Workspace/project budgets use the existing usage ledger.
5. An on-demand Trigger task persists job handles before polling, bounds waits,
   downloads and retries, validates actual media and stores private R2 outputs.
   Ambiguous possibly-billed submissions retain a reconciliable charged state;
   they cannot be blindly submitted again or refunded as uncharged failures.
6. Queued cancellation is atomic. Running cancellation is capability-specific
   and never promises a provider refund. No additional scheduled sweeper or
   idle monitoring; extend existing recovery without changing frequency.
7. Imported/generated video reuse creates project-owned media where required,
   retaining the shared library original. Approval and visual selection remain
   explicit, revision protected, audited and tenant scoped.
8. Timeline, preview and Remotion use the same media choice, trim, contain/crop
   and loop policies. Preserve legacy image-only snapshots and block unsupported
   clips before render. Native model audio cannot accidentally double narration.

## Delivery checklist

Implementation and isolated verification are complete; production release is in progress. Four direct models across Google, Runway and Luma share authenticated quotes, reservations and durable workers. Both migrations passed on a production clone with unchanged business fingerprints. The final full suite passed 2,960 tests (163 skipped), all 55 mocked browser journeys passed, TypeScript passed and lint has only three existing warnings. Two additional actual-SQL readiness tests and the production-clone readiness query pass. A real local Remotion export verified mixed media, contain bars, looping and independent narration. No paid generation has run. The final production build passes; production migration/deployment and the bounded Google smoke remain.

- [x] Shared contracts, capability validation, quotes and idempotency rules.
- [x] Verified official provider/model matrix and adapters with mocked tests.
- [x] Generated additive migrations, constraints and isolated database tests.
- [x] Durable generation commands, authorization, budgets and worker lifecycle.
- [x] Direct Video Studio: prompt, models, assets, supported controls, estimate,
      confirmation, progress, cancellation, history, result review and library reuse.
- [x] Project default/per-scene choices and generation/reuse/review controls.
- [x] Mixed still/video preview, timeline and final rendering with legacy safety.
- [x] Existing usage, audit, media inspection and recovery integration.
- [x] Responsive Light/Dark UI and keyboard/error/loading/empty states.
- [x] Documentation, environment ownership, setup and rollout instructions.
- [ ] Formatting, lint, TypeScript, unit/integration tests, critical mocked
      browser journeys, environment checks, production build and dependency audit
      when dependencies change.
- [ ] Requirement-by-requirement completion audit with concrete evidence.

## Operating constraints

Live generation starts disabled while building. Production release is authorized
after the completed feature's checks and additive migrations are verified. Only
the bounded Google smoke test above is authorized for live generation during
verification. No public posting is authorized. Existing
owner-only access, MCP behavior, Marketing pause and LinkedIn Pages hold remain
intact. Verification uses mocked providers/workers and isolated PostgreSQL.

## Evidence and open release checks

The original baseline had a scene-only start task, a 720p ceiling, discarded native audio and image-only timeline inputs. The new implementation replaces these limits for the new generator and carries selected footage through actual previews and renders. Existing legacy workers remain disabled and share the conservative single-job video queue.

Provider access and live output quality/cost cannot be verified without actual
account access and explicit spending approval. The implementation must expose
this honestly while remaining fully testable with deterministic fixtures.
