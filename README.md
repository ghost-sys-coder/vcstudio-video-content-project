# VCStudio

## Project overview

This repository is the foundation for an internal production tool that converts narration scripts into structured scenes, generated media, synchronized timelines, and rendered videos.

## Current capabilities

- Public landing page and shared Clerk sign-in/sign-up presentation.
- Lazy Clerk user synchronization into PostgreSQL.
- Signed, idempotent Clerk user lifecycle webhook processing.
- First-workspace onboarding with transactional owner membership creation.
- Authenticated application shell, workspace selector, user account menu, a data-driven workspace dashboard, and access-denied state.
- Central `owner`, `editor`, and `viewer` authorization policies.
- Private Cloudflare R2 workspace-logo uploads with a 5 MB limit and object cleanup on replacement or deletion.
- Responsive shadcn application sidebar with persistent desktop collapse state and a mobile drawer.
- Owner-only workspace profile management for workspace names and private logos.
- Workspace-scoped project creation, pagination, settings, status transitions, and archiving.
- Optimistically locked script drafts with immutable version numbering, restore-as-new-version behavior, and audited owner/editor soft deletion of eligible versions.
- Route-backed project tabs and a bounded, internally scrollable long-script editor.
- Approved script versions, cost-confirmed Trigger.dev scene analysis, crashed-run reconciliation and retry, schema-constrained OpenAI output, editable immutable scene versions, and scene approval.
- Searchable two-pane scene navigation with URL-addressable selection, status filtering, approval progress, and unsaved-change protection.
- Workspace-scoped character profiles, private validated R2 reference galleries, archival, and immutable scene-version character assignments.
- Validated character JSON import from pasted content, local files, or a built-in sample.
- Versioned scene-image prompts and workspace style presets, cost-confirmed single-scene GPT Image generation, exact character-reference snapshots, private R2 assets, review history, and atomic per-scene-version approval.
- Draft (`low`), final (`medium`), and explicit high-quality image modes using only the supported landscape, portrait, and square OpenAI sizes; Remotion will crop or fit these assets to final video dimensions in a later phase.
- Storyboard grid with controlled bulk image generation: per-scene selection and status filtering, a confirmation dialog showing scene count, estimated cost, and remaining budget, a live batch-progress panel (queued/running/succeeded/failed/cancelled with actual cost), per-scene regenerate/retry, bulk and per-scene approval, and cancellation of not-yet-billed queued generations.
- Per-scene narration audio (OpenAI text-to-speech) with workspace voice presets, single and bulk generation, cost confirmation and budget enforcement, audio playback and review/approval, FFprobe-measured durations, and a deterministic project timeline (ordered scenes, configured padding, millisecond and frame boundaries without cumulative drift).
- Deterministic subtitles and a typed video timeline contract: captions are derived from each scene's approved narration audio (scene- or sentence-level segments, timing distributed across the measured audio duration by character proportion — never fabricated word timestamps), with editable per-cue text overrides, a configurable caption style (font, size, colors, position, safe margin, casing) and live preview, SRT and WebVTT export, Remotion caption input, and a `VideoTimeline` builder that assembles approved image + audio + captions + camera motion + transition per scene, rejects construction when any approved asset is missing, and returns an actionable per-scene validation report.
- Remotion video preview and durable rendering: an in-browser Remotion Player preview of the assembled video (scene stills under deterministic subtle camera motion, cut/fade transitions, burned-in captions, narration audio, optional watermark, toggleable safe-area guides), landscape/vertical/square output presets at configurable frame rate, cost-estimated and budget-reserved render start that freezes an immutable timeline snapshot, a concurrency-one Trigger.dev rendering queue that bundles the composition and drives a headless Chromium, private R2 MP4 exports with authorized signed downloads, live render progress, failure surfacing, and an expired-reservation reconciler.

## Architecture

The application is a TypeScript modular monolith. Next.js owns web routes and server functions, Clerk provides authentication, and Neon PostgreSQL is authoritative for application users, workspaces, memberships, roles, and active-workspace authorization. Database access is isolated in repositories, queries, and commands; authorization policies live outside React components.

The repository will move into the full `apps/` and `packages/` monorepo structure during the broader bootstrap phase. Phase 1 uses the current root Next.js application without introducing a second application structure prematurely.

## Technology stack

Next.js 16, React 19, strict TypeScript, Tailwind CSS, shadcn/ui, Clerk, Neon PostgreSQL, Drizzle ORM, Trigger.dev 4.5.4, OpenAI Responses API, Cloudflare R2, Sharp, Remotion 4 (`remotion`, `@remotion/player`, `@remotion/bundler`, `@remotion/renderer`), Zod, Vitest, ESLint, and Prettier.

## Repository structure

```text
app/                 App Router pages, layouts, actions, settings, and route handlers
components/          One React component per PascalCase file
db/                  Drizzle schema, client, repositories, queries, and commands
lib/auth/            Clerk synchronization and workspace context
lib/domain/          Typed application errors
lib/env/             Environment validation
lib/policies/        Central workspace authorization rules
lib/schemas/         External input validation
lib/openai/          Narrow server-only OpenAI provider implementation
lib/subtitles/       Pure subtitle segmentation, track assembly, and SRT/WebVTT/Remotion serializers
lib/timeline/        Deterministic scene and video timeline builders
lib/render/          Render domain logic: presets, camera motion, cost, snapshot, provider, orchestration
remotion/            Remotion composition components, root, and bundler entry (one component per file)
packages/prompts/    Versioned `@studio/prompts` workspace package
lib/costs/           Provider estimation and reconciliation calculations
migrations/          Generated immutable SQL migrations
trigger/             Durable background tasks and queue configuration
docs/                Bootstrap and phase specifications
```

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and supply the required values.
4. Run `npm run db:migrate` after reviewing the generated migration.
5. Run `npm run dev` and open `http://localhost:3000`.

## Environment variables

| Variable                                            | Visibility  | Required    | Purpose                                                            |
| --------------------------------------------------- | ----------- | ----------- | ------------------------------------------------------------------ |
| `APP_NAME`                                          | Server only | Yes         | Human-readable application name (`VCStudio`).                      |
| `NEXT_PUBLIC_APP_URL`                               | Browser     | Yes         | Canonical web application URL.                                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                 | Browser     | Yes         | Identifies the Clerk application.                                  |
| `CLERK_SECRET_KEY`                                  | Server only | Yes         | Authenticates server-side Clerk operations.                        |
| `CLERK_WEBHOOK_SIGNING_SECRET`                      | Server only | Yes         | Verifies Clerk webhook signatures.                                 |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                     | Browser     | Yes         | Clerk sign-in route.                                               |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                     | Browser     | Yes         | Clerk sign-up route.                                               |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`   | Browser     | Yes         | Post-sign-in destination.                                          |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`   | Browser     | Yes         | Post-sign-up destination.                                          |
| `DATABASE_URL`                                      | Server only | Yes         | Pooled Neon URL used by application requests.                      |
| `DATABASE_URL_UNPOOLED`                             | Server only | Recommended | Direct Neon URL preferred by migration commands.                   |
| `RUN_DATABASE_INTEGRATION_TESTS`                    | Test only   | No          | Enables mutating integration tests against development Neon only.  |
| `NODE_ENV`                                          | Server only | Automatic   | Runtime mode; defaults to `development`.                           |
| `R2_ACCOUNT_ID`                                     | Server only | Yes         | Cloudflare account owning the R2 bucket.                           |
| `R2_ACCESS_KEY_ID`                                  | Server only | Yes         | R2 S3 API access key.                                              |
| `R2_SECRET_ACCESS_KEY`                              | Server only | Yes         | R2 S3 API secret key.                                              |
| `R2_BUCKET_NAME`                                    | Server only | Yes         | Private media bucket name.                                         |
| `R2_ENDPOINT`                                       | Server only | Yes         | Account-specific R2 S3 endpoint.                                   |
| `R2_REGION`                                         | Server only | Yes         | R2 region (`auto`).                                                |
| `R2_SIGNED_UPLOAD_EXPIRY_SECONDS`                   | Server only | Yes         | Upload URL lifetime, 60–900 seconds.                               |
| `R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS`                 | Server only | Yes         | Download URL lifetime, 60–3600 seconds.                            |
| `MAX_CHARACTER_REFERENCE_SIZE_BYTES`                | Server only | Yes         | Maximum character reference size (`5242880`).                      |
| `ALLOWED_IMAGE_MIME_TYPES`                          | Server only | Yes         | Allowed character image MIME types.                                |
| `MIN_REFERENCE_IMAGE_WIDTH`                         | Server only | Yes         | Minimum character reference width (`512`).                         |
| `MIN_REFERENCE_IMAGE_HEIGHT`                        | Server only | Yes         | Minimum character reference height (`512`).                        |
| `MAX_REFERENCE_IMAGE_WIDTH`                         | Server only | Yes         | Maximum character reference width (`4096`).                        |
| `MAX_REFERENCE_IMAGE_HEIGHT`                        | Server only | Yes         | Maximum character reference height (`4096`).                       |
| `ENABLE_CHARACTER_LIBRARY`                          | Server only | Yes         | Enables the Phase 4 character library.                             |
| `MAX_SCRIPT_CHARACTERS`                             | Server only | Yes         | Maximum narration script length (`50000`).                         |
| `DEFAULT_PROJECT_BUDGET_CENTS`                      | Server only | Yes         | New-project budget ceiling default (`200`).                        |
| `OPENAI_API_KEY`                                    | Server only | Yes         | Authenticates OpenAI Responses API calls.                          |
| `OPENAI_TEXT_MODEL`                                 | Server only | Yes         | Configurable structured scene-analysis model.                      |
| `OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS`          | Server only | Yes         | Model input price used for cost controls.                          |
| `OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS`         | Server only | Yes         | Model output price used for cost controls.                         |
| `OPENAI_REQUEST_TIMEOUT_SECONDS`                    | Server only | Yes         | Shared OpenAI request timeout (`180`).                             |
| `OPENAI_IMAGE_MODEL`                                | Server only | Yes         | Image model alias or dated snapshot (`gpt-image-2`).               |
| `OPENAI_IMAGE_DRAFT_QUALITY`                        | Server only | Yes         | Draft quality; Phase 5 requires `low`.                             |
| `OPENAI_IMAGE_FINAL_QUALITY`                        | Server only | Yes         | Final quality; Phase 5 requires `medium`.                          |
| `OPENAI_IMAGE_OUTPUT_FORMAT`                        | Server only | Yes         | Generated image format (`webp` by default).                        |
| `OPENAI_IMAGE_DRAFT_COMPRESSION`                    | Server only | Yes         | Draft WebP/JPEG compression (`80`).                                |
| `OPENAI_IMAGE_FINAL_COMPRESSION`                    | Server only | Yes         | Final WebP/JPEG compression (`90`).                                |
| `OPENAI_IMAGE_BACKGROUND`                           | Server only | Yes         | Opaque or automatic image background.                              |
| `OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS`    | Server only | Yes         | Image-model text-input price (`500`).                              |
| `OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS`         | Server only | Yes         | Image-reference input price (`800`).                               |
| `OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS`        | Server only | Yes         | Generated-image output price (`3000`).                             |
| `OPENAI_IMAGE_LOW_SQUARE_ESTIMATE_CENTS`            | Server only | Yes         | Conservative low-quality square reservation.                       |
| `OPENAI_IMAGE_LOW_RECTANGULAR_ESTIMATE_CENTS`       | Server only | Yes         | Conservative low-quality rectangular reservation.                  |
| `OPENAI_IMAGE_MEDIUM_SQUARE_ESTIMATE_CENTS`         | Server only | Yes         | Conservative medium square reservation.                            |
| `OPENAI_IMAGE_MEDIUM_RECTANGULAR_ESTIMATE_CENTS`    | Server only | Yes         | Conservative medium rectangular reservation.                       |
| `OPENAI_IMAGE_HIGH_SQUARE_ESTIMATE_CENTS`           | Server only | Yes         | Conservative high-quality square reservation.                      |
| `OPENAI_IMAGE_HIGH_RECTANGULAR_ESTIMATE_CENTS`      | Server only | Yes         | Conservative high-quality rectangular reservation.                 |
| `OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET`    | Server only | Yes         | Extra reservation per selected reference.                          |
| `MAX_IMAGE_GENERATION_RETRIES`                      | Server only | Yes         | Maximum bounded billable retries (`1`).                            |
| `MAX_REFERENCE_ASSETS_PER_GENERATION`               | Server only | Yes         | Application reference limit, maximum `16`.                         |
| `MAX_REFERENCE_BYTES_PER_GENERATION`                | Server only | Yes         | Aggregate downloaded reference-byte ceiling.                       |
| `MAX_IMAGE_GENERATIONS_PER_SCENE_VERSION`           | Server only | Yes         | Per-version generation and returned-history cap.                   |
| `MAX_IMAGES_PER_BATCH`                              | Server only | Yes         | Maximum scenes per Phase 6 bulk storyboard batch.                  |
| `ENABLE_SCENE_IMAGE_GENERATION`                     | Server only | Yes         | Phase 5/6 generation feature switch.                               |
| `OPENAI_TTS_MODEL`                                  | Server only | Yes         | Phase 7 text-to-speech model (default `gpt-4o-mini-tts`).          |
| `OPENAI_TTS_VOICE`                                  | Server only | Yes         | Default narration voice for new voice presets.                     |
| `OPENAI_TTS_FORMAT`                                 | Server only | Yes         | Default audio container (`mp3`/`opus`/`aac`/`flac`/`wav`/`pcm`).   |
| `OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS`      | Server only | Yes         | Character-based TTS pricing used for estimates and reconciliation. |
| `MAX_SCENES_PER_AUDIO_BATCH`                        | Server only | Yes         | Maximum scenes per Phase 7 audio generation request.               |
| `AUDIO_SCENE_PADDING_MILLISECONDS`                  | Server only | Yes         | Padding inserted between scenes in the computed timeline.          |
| `FFPROBE_PATH`                                      | Server only | Yes         | ffprobe binary used to measure narration audio duration.           |
| `ENABLE_SCENE_AUDIO_GENERATION`                     | Server only | Yes         | Phase 7 audio generation feature switch.                           |
| `SUBTITLE_MAX_LINE_CHARACTERS`                      | Server only | Yes         | Default caption wrap length for new caption styles (`42`).         |
| `SUBTITLE_MIN_SEGMENT_DURATION_MILLISECONDS`        | Server only | Yes         | Minimum caption duration; shorter segments merge (`700`).          |
| `SUBTITLE_MAX_SEGMENT_DURATION_MILLISECONDS`        | Server only | Yes         | Advisory ceiling flagging long captions in review (`7000`).        |
| `SUBTITLE_DURATION_MISMATCH_TOLERANCE_MILLISECONDS` | Server only | Yes         | Audio-vs-estimate gap that raises a timeline warning (`1500`).     |
| `ENABLE_SUBTITLES`                                  | Server only | Yes         | Phase 8 subtitle feature switch.                                   |
| `TRIGGER_SECRET_KEY`                                | Server only | Yes         | Authenticates Trigger.dev task submissions.                        |
| `TRIGGER_PROJECT_REF`                               | Server only | Yes         | Identifies the Trigger.dev project.                                |
| `IDEMPOTENCY_HASH_SECRET`                           | Server only | Yes         | HMAC secret for billable-operation identity.                       |
| `REQUEST_FINGERPRINT_SECRET`                        | Server only | Yes         | HMAC secret for prompt request fingerprints.                       |
| `MAX_SCENES_PER_PROJECT`                            | Server only | Yes         | Maximum structured scenes returned per analysis.                   |
| `MIN_SCENE_DURATION_MILLISECONDS`                   | Server only | Yes         | Minimum generated scene duration.                                  |
| `MAX_SCENE_DURATION_MILLISECONDS`                   | Server only | Yes         | Maximum generated scene duration.                                  |
| `MAX_SCENE_ANALYSIS_RETRIES`                        | Server only | Yes         | Maximum bounded text-analysis retries.                             |
| `GENERATION_RESERVATION_EXPIRY_MINUTES`             | Server only | Yes         | Pending AI reservation lifetime (`30`).                            |
| `DEFAULT_DAILY_BUDGET_CENTS`                        | Server only | Yes         | Default workspace daily AI budget.                                 |
| `DEFAULT_MONTHLY_BUDGET_CENTS`                      | Server only | Yes         | Default workspace monthly AI budget.                               |
| `ENABLE_VIDEO_RENDERING`                            | Both        | No          | Master switch for Phase 9 preview/render (default `true`).         |
| `VIDEO_RENDER_COST_PER_MINUTE_CENTS`                | Both        | No          | Compute cost per output minute; must match across targets.         |
| `VIDEO_RENDER_MINIMUM_ESTIMATE_CENTS`               | Both        | No          | Minimum render cost floor.                                         |
| `MAX_RENDER_DURATION_SECONDS`                       | Both        | No          | Maximum renderable output length (cost-control limit).             |
| `MAX_RENDER_ATTEMPTS`                               | Both        | No          | Billable render retry ceiling.                                     |
| `VIDEO_RENDER_RESERVATION_EXPIRY_MINUTES`           | Both        | No          | Render reservation expiry window.                                  |
| `VIDEO_WATERMARK_ENABLED` / `VIDEO_WATERMARK_TEXT`  | Both        | No          | Optional burned-in watermark toggle and text.                      |
| `VIDEO_RENDER_CONCURRENCY`                          | Trigger.dev | No          | Worker render concurrency (default 1).                             |
| `VIDEO_RENDER_TIMEOUT_SECONDS`                      | Trigger.dev | No          | Per-render worker timeout.                                         |
| `VIDEO_RENDER_CRF` / `VIDEO_RENDER_JPEG_QUALITY`    | Trigger.dev | No          | H.264 quality and frame JPEG quality.                              |
| `REMOTION_CHROMIUM_EXECUTABLE`                      | Trigger.dev | No          | Optional explicit headless Chromium path.                          |

## Database setup

`db/schema.ts` defines application users, workspaces, memberships, projects, scripts, immutable scene versions, characters, immutable style-preset versions, image generations, exact reference snapshots, provider attempts, usage reservations/events, storage metadata, and Clerk webhook delivery records. Generate migrations with `npm run db:generate` and apply reviewed migrations with `npm run db:migrate`. Migration commands prefer `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL` when necessary.

Multi-statement writes use atomic Neon HTTP batches because the Drizzle `neon-http` driver does not support interactive callback transactions.

The initial Phase 1 migration is `migrations/20260715131000_tidy_tinkerer/migration.sql`.
It was applied successfully to the configured development Neon database on 2026-07-15.

The Phase 2 project and script migration is `migrations/20260715162113_warm_misty_knight/migration.sql`. It was applied successfully to the configured development Neon database on 2026-07-15.

The Phase 3 scene-planning migration is `migrations/20260715204954_rainy_umar/migration.sql`. It was applied successfully to the configured development Neon database on 2026-07-15.

The script-version deletion audit migration is `migrations/20260715222820_absurd_yellowjacket/migration.sql`. It adds soft-deletion actor and timestamp fields to script versions and was applied successfully to the configured development Neon database on 2026-07-16.

The Phase 4 character-library migration is `migrations/20260716185811_bumpy_thunderbolts/migration.sql`. It adds workspace characters, private reference metadata, destructive-operation audit records, and scene-version character assignments. It was applied successfully to the configured development Neon database on 2026-07-16.

The Phase 8 subtitle migration is `migrations/20260718124356_heavy_hellcat/migration.sql`. It adds the `project_subtitle_settings` table (one workspace-scoped row per project holding the caption granularity, the validated caption-style JSONB, and per-cue text overrides) and the `subtitle_granularity` enum. It was applied successfully to the configured development Neon database on 2026-07-18.

The Phase 9 rendering migration is `migrations/20260718171124_old_mac_gargan/migration.sql`. It adds the `render_status` enum, the `video_renders` table (one row per render holding its geometry, include-flags, immutable timeline snapshot JSONB, cost, progress, and export asset metadata), the `video_render` value on the `usage_operation_type` enum, and a `video_render_id` column plus tenant foreign key on `usage_reservations` with the single-operation check constraint extended so renders flow through the same money-safe ledger. It was applied successfully to the configured development Neon database on 2026-07-18.

The Phase 5 image-generation migrations are `migrations/20260716210756_dark_logan/migration.sql`, `migrations/20260716211907_old_argent/migration.sql`, and `migrations/20260716222105_amused_spirit/migration.sql`. They add immutable style and prompt versions, scene image generations, exact selected-reference snapshots, per-attempt provider records, generalized usage reservations/events, the initial stick-figure financial-education preset, prompt/style immutability guards, idempotent usage-event indexing, composite tenant-integrity constraints, reconciliation indexes, and append-only ledger protection. All three were applied successfully to the configured development Neon database on 2026-07-16.

## Clerk setup

Configure Clerk with `/sign-in` and `/sign-up`, then create a webhook endpoint targeting `/api/webhooks/clerk`. Subscribe to:

- `user.created`
- `user.updated`
- `user.deleted`

Copy the endpoint signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`. Workspace roles are not sourced from Clerk Organizations; PostgreSQL membership rows are authoritative.

## Trigger.dev setup

Phase 3 defines `scene-analysis` in the `ai-text` queue. Phase 5 adds `scene-image-generation` in the concurrency-limited `image-generation` queue and the five-minute `reconcile-expired-scene-images` scheduled task. Add the relevant server, OpenAI image, R2, budget, fingerprint, reservation, and retry variables to the Trigger.dev environment; run `npm run trigger:dev` alongside Next.js locally and deploy tasks with `npm run trigger:deploy`.

Both generation tasks validate reservation ownership, status, expiry, amount, prompt fingerprint, idempotency, and immutable input versions before a billable call. Image generation also recovers a deterministic R2 object after a worker interruption, prevents ambiguous provider retries, and records one provider-attempt row per billable attempt. Browser polling handles active feedback, while the scheduled reconciler independently converts Trigger crashes, cancellations, missing runs, completion mismatches, and expired reservations into explicit terminal application states.

Phase 9 adds `video-render` in the concurrency-one `video-rendering` queue and the five-minute `reconcile-expired-video-render` scheduled task. The render worker bundles the Remotion composition and drives a headless Chromium, so `trigger.config.ts` ships the `remotion/`, `lib/`, and `db/` source via the `additionalFiles` build extension and installs Chromium's system libraries via `aptGet`. The task validates render ownership, reservation status, and attempt limits, recovers an already-uploaded MP4 after a crash, resolves scene assets to short-lived signed URLs, validates the composition input before rendering, uploads the export to private R2, and reconciles the reservation to actual cost. Because the render only runs in the deployed worker, the Chromium package list and bundled-source paths must be validated on first deploy.

## Storage setup

Workspace-logo storage uses a private Cloudflare R2 bucket. Objects use workspace-scoped keys such as `workspaces/{workspaceId}/branding/logos/{assetId}.png`; PostgreSQL stores metadata and ownership rather than image bytes or permanent public URLs.

Character references use keys such as `workspaces/{workspaceId}/characters/{characterId}/references/{referenceType}/{assetId}.webp`. Completion downloads the private object and uses Sharp to verify its real format and dimensions before persisting metadata. Core identity views replace their prior object; expression, outfit, and pose references allow multiple images. Deleting or replacing a reference removes its R2 object.

Generated scene images use deterministic keys such as `workspaces/{workspaceId}/projects/{projectId}/scenes/{sceneId}/versions/{sceneVersionId}/images/{generationId}.webp`. The Trigger.dev task verifies the generated bytes and dimensions before upload, stores recovery metadata on the private R2 object, and exposes images only through an authorized short-lived download route. Exact selected character-reference asset identifiers and immutable object metadata are retained with each generation record.

Configure the bucket CORS policy to allow `PUT` from every browser origin that uploads directly to R2, including `http://localhost:3000` and the stable production origin `https://vcstudio.vercel.app`, with the `Content-Type` header. Deployment-specific preview URLs must be added explicitly before uploads will work from previews. Upload URLs expire according to `R2_SIGNED_UPLOAD_EXPIRY_SECONDS`; private logo display uses short-lived signed download URLs. Logo uploads accept PNG, JPEG, and WebP files up to 5 MB. Replacing or deleting a logo removes the superseded R2 object.

## OpenAI setup

Set `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, and the text model's input/output price variables. Scene analysis uses the Responses API with Zod-backed structured output. For the configured `gpt-5.6-luna` model, the documented July 2026 rates are represented as `100` input cents and `600` output cents per million tokens. Update both the model and its pricing variables together when changing models.

Phase 5 uses the configurable `OPENAI_IMAGE_MODEL` provider default (`gpt-image-2`) with the Images API. Requests without references use image generation; requests with references use image editing and GPT Image 2's automatic high-fidelity reference handling. Only the API-supported `1536x1024`, `1024x1536`, and `1024x1024` sizes are accepted. Drafts default to low quality and 80% WebP compression; finals default to medium quality and 90% compression. High quality is an explicit per-request choice. Store the model and pricing configuration with each deployment so a dated model snapshot can be selected later without a code change.

## Rendering setup

Rendering uses Remotion 4. The in-browser preview renders the composition with `@remotion/player`; the durable render runs in the Trigger.dev `video-render` task, which bundles the composition with `@remotion/bundler` and encodes with `@remotion/renderer` (H.264 via the ffmpeg build extension) driving a headless Chromium. The renderer and bundler are declared in `serverExternalPackages` so they never enter the Next.js bundle — only the `video-render` task imports them. Supported outputs are 1920×1080 landscape, 1080×1920 vertical, and 1080×1080 square at the project's frame rate; the render always uses the project's aspect ratio because scene images are generated at that ratio. Set the Phase 9 render variables in both Vercel and Trigger.dev (encoder/browser settings are Trigger.dev-only). The end-to-end Chromium render can only be validated by deploying the task; local verification covers typecheck, lint, unit tests, the production build, and the opt-in PostgreSQL render-invariant suite.

## Development commands

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run start` starts the production server.
- `npm run format` formats the repository.
- `npm run format:check` checks formatting.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs strict TypeScript checking.
- `npm run db:generate` generates a new Drizzle migration.
- `npm run db:migrate` applies pending Drizzle migrations.
- `npm run trigger:dev` runs Trigger.dev tasks locally.
- `npm run trigger:deploy` deploys Trigger.dev tasks.

## Testing commands

- `npm test` runs Vitest once.
- `npm run test:coverage` runs tests with V8 coverage.
- `$env:RUN_DATABASE_INTEGRATION_TESTS="true"; npm test -- --run db/integration/scene-image-postgres.integration.test.ts; Remove-Item Env:RUN_DATABASE_INTEGRATION_TESTS` runs the opt-in Phase 5 PostgreSQL invariant suite from PowerShell.
- `RUN_DATABASE_INTEGRATION_TESTS=true npm test -- --run db/integration/scene-image-postgres.integration.test.ts` runs the same suite from a POSIX shell.
- The Phase 9 render invariants live in `db/integration/video-render-postgres.integration.test.ts` and run the same way (idempotent reservation, budget rejection, cancel/complete/fail reconciliation, and cross-workspace isolation).

Tests cover authentication gating, environment validation, workspace role permissions, nonmember rejection, cross-workspace isolation, project and budget validation, pagination limits, project status transitions, script statistics, scene structured output, prompt determinism and versioning, image-reference ordering and isolation, idempotency, cost estimation and reconciliation, budget reservation, retry limits, provider failure classification, R2 upload and recovery keys, scene timing, character slugs and archival behavior, reference dimensions and storage keys, upload sequencing, Clerk user deletion routing, subtitle segmentation and caption-style validation, SRT/WebVTT generation, subtitle segment overlap prevention, deterministic video timeline output with missing-asset validation, duration-mismatch detection and frame-count calculation, render format presets and aspect-ratio configuration, deterministic camera-motion interpolation, caption safe areas, render duration and cost calculation, composition-input validation, render idempotency-key derivation, video-export object keys and download authorization, the `renderVideo` capability, and opt-in concurrent PostgreSQL checks for Phase 5 and Phase 9 terminal state, reservation reconciliation, and tenant invariants.

The database integration suite is skipped by default. Run it only against a development Neon database after applying reviewed migrations. Each run creates UUID-isolated fixtures and removes them through their workspace parent cascade; it never calls OpenAI, R2, or Trigger.dev.

## Deployment

Set every required environment variable in the deployment environment. The Phase 5 OpenAI image, R2, budget, fingerprint, reservation, and retry variables must be present in both Vercel and Trigger.dev because the web application creates reservations while the worker executes and reconciles them. The Phase 8 subtitle variables are Vercel-only: subtitles are derived entirely in the web runtime, so they are added to `.env.vercel` (and `.env`/`.env.example`) but intentionally omitted from `.env.trigger.dev`. The Phase 9 render variables are split by target: the shared cost/limit/enable/watermark values must match in both Vercel and Trigger.dev so worker-side actual costs reconcile against web-side reserved estimates, while the encoder/browser settings (`VIDEO_RENDER_CONCURRENCY`, `VIDEO_RENDER_TIMEOUT_SECONDS`, `VIDEO_RENDER_CRF`, `VIDEO_RENDER_JPEG_QUALITY`, `REMOTION_CHROMIUM_EXECUTABLE`) are Trigger.dev-only. Configure a production Clerk webhook endpoint separately from development, apply migrations before promoting dependent application code, and deploy the Trigger.dev task with `npm run trigger:deploy`.

## Security model

Clerk authenticates sessions; PostgreSQL authorizes application access. Every protected server resource calls Clerk protection and then resolves the local user. A workspace ID from a cookie or form is only a preference and is never trusted: every workspace operation queries membership by both `userId` and `workspaceId`. Workspace creation and initial ownership are transactional. Webhooks are verified before parsing, deduplicated by Svix delivery ID, and store only safe failure summaries.

Deleted Clerk users are soft-deleted and anonymized locally so workspace ownership and audit relationships remain intact. Script-version deletion is restricted to owners and editors, scoped by the authenticated workspace, and records the deleting user and timestamp.

Scene-image configuration, generation history, reference selection, asset delivery, approval, and rejection are authorized by workspace-scoped project and scene identifiers resolved on the server. Composite foreign keys also prevent Phase 5 generation, reference, provider-attempt, reservation, and usage-event rows from crossing workspace or project boundaries. Only owners and editors can generate or review images. Private reference and generated-image objects are never exposed as permanent public URLs.

Video renders and exports are workspace-scoped by composite foreign keys and are gated by the `renderVideo` capability (owners and editors only). The export bucket is private: downloads flow through an authorized route that resolves the render by both workspace and project, confirms it succeeded and owns a workspace-scoped object key, and only then redirects to a freshly minted short-lived signed URL. Signed asset and export URLs are never logged, and the render timeline snapshot stores object keys rather than signed URLs so a persisted render never leaks credentials.

## Cost controls

Scene analysis and scene-image generation show a conservative estimate before confirmation. Their reservation commands serialize spending checks per workspace, enforce project plus daily and monthly workspace limits atomically, and append application-level ledger events. Image generation records each provider attempt and actual token usage, reconciles the reservation to actual cost, releases unused value, and uses a conservative reserved-cost fallback when usage is unavailable. Every explicit Generate action creates a new paid generation version; billable retries are bounded by `MAX_IMAGE_GENERATION_RETRIES` and never silently reuse an older image.

Video rendering has no per-render provider invoice, so its cost is derived from output duration at `VIDEO_RENDER_COST_PER_MINUTE_CENTS` (rounded up to the minute, with a minimum floor) and shown before the render starts. Starting a render reserves that estimate through the same money-safe ledger under a per-workspace advisory lock and project/daily/monthly budget guard, then reconciles to the same figure on success or releases it on cancellation, expiry, or pre-compute failure. Renders longer than `MAX_RENDER_DURATION_SECONDS` are rejected before any compute, billable retries are bounded by `MAX_RENDER_ATTEMPTS`, and an identical timeline reuses its existing render rather than billing again.

## Current limitations

- Invitations and billing are intentionally excluded from Phase 1.
- Workspace membership management UI is not implemented yet.
- `CLERK_WEBHOOK_SIGNING_SECRET` must be configured before real webhook delivery can succeed.
- The Phase 1 migration must still be applied separately to future preview and production databases.
- Full browser end-to-end coverage will be expanded with the bootstrap Playwright foundation.
- The end-to-end Remotion render runs only in the deployed Trigger.dev worker (headless Chromium via a build extension); it cannot be exercised locally. The Chromium `aptGet` package list and the `additionalFiles` bundled-source paths in `trigger.config.ts` must be validated on first deploy, and the whole task is gated by `ENABLE_VIDEO_RENDERING`.
- Render output always uses the project's aspect ratio; the other format presets are shown but disabled because scene images are generated at the project ratio. Camera motion and transitions are assigned deterministically per scene rather than authored per scene.
- Subtitle word-level timing is intentionally never synthesized; captions use scene- or sentence-level timing distributed across the measured audio duration. Per-cue timing is not hand-editable (only cue text), because timing is always recomputed deterministically from approved audio.
- Phase 5 generates one scene image per confirmed request. Batch generation and a workspace style-preset editor are deferred; the immutable seeded preset and generation history are available now.
- Remotion crop/fit behavior for translating OpenAI's supported image sizes to final video dimensions will be added with rendering.
- Script version history is currently bounded to the latest 50 versions in the editor.
- Approved script versions and versions referenced by scene analysis are retained and cannot be deleted.
- Trigger.dev must be running locally or deployed before queued scene analyses or image generations execute.
- Safe npm overrides pin vulnerable `ws` and `cookie` transitive dependencies to patched releases. The dependency tree currently retains 32 moderate transitive advisories in Trigger.dev OpenTelemetry/esbuild, Next.js PostCSS, and Clerk UI dependency chains. The development-only Trigger.dev CLI adds four high `tar` advisories; npm currently offers only breaking forced downgrades rather than compatible remediations.

## Implementation status

Phases 1–9 are implemented through authenticated workspaces, project/script versioning, durable AI scene planning, workspace character consistency references, cost-controlled single-scene image generation and review, the storyboard with controlled bulk image generation, per-scene narration audio with FFprobe-measured durations and a deterministic project timeline, deterministic subtitles with a typed video timeline contract and SRT/WebVTT/Remotion caption outputs, and Remotion video preview plus durable, cost-controlled rendering to private R2 MP4 exports. The end-to-end Chromium render is exercised only in the deployed Trigger.dev worker.

## Recent major changes

- 2026-07-18: Implemented Phase 9 Remotion video preview and durable rendering — a new `render_status` enum and `video_renders` table with the `video_render` operation integrated into the money-safe usage ledger (advisory-locked budget reservation, reconcile/release on completion/cancel/expiry, and a `reconcile-expired-video-render` scheduled reconciler), pure render domain logic (landscape/vertical/square presets, deterministic subtle camera-motion interpolation, caption safe areas, duration and per-minute cost calculation, an immutable timeline snapshot builder, composition-input validation, and render idempotency), eleven one-per-file Remotion composition components plus a bundler entry (scene image, camera motion, captions, audio, transition, safe-area guides, watermark, background, scene, composition, root), a narrow `VideoRenderProvider` with a `@remotion/renderer` implementation kept out of the Next.js bundle via `serverExternalPackages`, a concurrency-one `video-render` Trigger.dev task that bundles the composition and drives a headless Chromium (provisioned via `additionalFiles` + `aptGet` in `trigger.config.ts`), private R2 MP4 exports with an authorized signed-download route, a `renderVideo` capability, a `/app/projects/[id]/render` route and tab with thirteen one-per-file UI components (preview workspace, Remotion Player preview, preset selector, settings form, timeline summary, validation dialog, start-render button, progress panel, status badge, error state, export card/list, download button) plus a preview API returning signed composition props, the Phase 9 render environment split by target (shared cost/limit/enable/watermark values in `.env.vercel` and `.env.trigger.dev`; encoder/browser settings Trigger.dev-only), and render unit tests plus an opt-in PostgreSQL render-invariant suite. The end-to-end Chromium render runs only in the deployed worker; typecheck, lint, unit tests, the production build, and the render integration suite pass locally.
- 2026-07-18: Grouped the subtitle caption editor by scene to remove endless scrolling — the cue list on the Subtitles tab now renders one collapsible accordion section per scene (via a new pure, unit-tested `groupSegmentsByScene` helper and a one-per-file `SubtitleSceneGroup` component), each header showing the cue count plus "N edited" / "N long" badges so flagged scenes are visible while collapsed, with the first scene open by default and an Expand all / Collapse all control. All per-cue editing, reset, badges, and export behavior are unchanged.
- 2026-07-18: Implemented Phase 8 deterministic subtitles and the typed video timeline contract — a new `project_subtitle_settings` table and `subtitle_granularity` enum (one row per project holding granularity, a validated caption-style JSONB, and per-cue text overrides keyed by `sceneVersionId:index`), pure subtitle domain logic (sentence/scene segmentation with no fabricated word timing, largest-remainder proportional timing that sums exactly to each scene's measured audio duration, overlap-free track assembly, SRT/WebVTT/Remotion serializers, and a canonical caption-style validator), a `buildVideoTimeline` builder that lays out approved image + audio + captions + camera motion + transition deterministically and returns an actionable per-scene validation report (blocking errors for missing assets, non-blocking duration-mismatch warnings), a workspace-only Phase 8 env group (five variables added to `.env`/`.env.vercel`/`.env.example` but deliberately not `.env.trigger.dev`, since no worker reads them), a `manageSubtitles` capability, a `/app/projects/[id]/subtitles` route and tab, subtitle GET and SRT/WebVTT export routes, eleven one-per-file components (workspace, track selector, editor, segment list/row, caption-style form, live preview, export buttons, timeline validation panel/issue, build-timeline button), and thirty-four unit tests covering SRT/WebVTT generation, overlap prevention, deterministic timeline output, missing-asset validation, duration-mismatch detection, frame-count calculation, segmentation, and caption-style validation.
- 2026-07-18: Added an at-a-glance image indicator to the Scenes tab — the scene navigator list and the selected scene's Images tab now show a badge (approved / generated / generating / failed) computed on the server from each scene's current-version generations, so users can see which scenes already have imagery without opening the Images panel.
- 2026-07-18: Implemented Phase 7 per-scene narration audio, review, and timing — new `voice_presets` and `scene_audio_generations` tables plus a `scene_audio_generation` operation type and `audio_generation_id` on the shared usage ledger (extended via `operation_type::text` comparisons to avoid the same-transaction enum-safety error), an OpenAI TTS provider, a shell-safe FFprobe wrapper (with a pure, unit-tested JSON parser) provisioned in production through the Trigger.dev `ffmpeg` build extension, a deterministic drift-free timeline service (integer milliseconds, absolute frame conversion, configurable padding), workspace voice presets, a bulk-capable audio orchestrator reusing the Phase 5/6 reservation/budget/idempotency machinery, a concurrency-limited `scene-audio-generation` task with graceful degradation when ffprobe is missing (paid audio is kept, duration marked pending), a five-minute expired-reservation reconciler, a `/app/projects/[id]/audio` route and tab with fifteen one-per-file components, and unit plus opt-in PostgreSQL audio invariant tests.
- 2026-07-17: Implemented Phase 6 storyboard and controlled bulk image generation — a new `scene_image_batches` table and nullable `batch_id` on generations (live-derived aggregate counts, no mutable counters), a `MAX_IMAGES_PER_BATCH` limit added to all environment files, a bulk orchestrator that reserves each eligible scene through the proven Phase 5 machinery and dispatches them with a single Trigger.dev `tasks.batchTrigger` (respecting the image-generation queue concurrency), idempotent duplicate-submission handling, cancellation that releases only not-yet-billed reservations, a `/app/projects/[id]/storyboard` route and tab, a polling storyboard API, sixteen one-per-file storyboard components, and unit plus opt-in PostgreSQL batch invariant tests.
- 2026-07-17: Redesigned the projects and character library cards and page layouts — consistent eyebrow/title/count headers, ring-styled cards with footers (project budget and updated date; per-character reference counts and initials avatars), a new workspace-scoped `listCharactersWithReferenceCounts` query, a shared `formatShortDate` helper, iconified empty states, and button-styled project pagination that only renders when multiple pages exist.
- 2026-07-17: Replaced the static dashboard placeholder with a data-driven workspace overview — workspace-scoped aggregate statistics (non-archived projects and active count, character library size, succeeded scene images and those awaiting review, and month-to-date image spend) queried through a new `dashboard.repository`, redesigned stat cards, and a recent-projects panel.
- 2026-07-16: Hardened Phase 5 persistence with database-enforced tenant relationships, indexed scheduled reconciliation and reference paths, snapshotted provider background configuration, nonnegative provider costs, an append-only usage ledger that still permits parent-driven cleanup, and passing opt-in PostgreSQL invariant coverage.
- 2026-07-16: Added Phase 5 immutable image prompts and style versions, GPT Image generation/editing with exact reference snapshots, private R2 assets, atomic cost reservations and reconciliation, Trigger.dev execution and recovery, generation history, and one-at-a-time scene-version approval.
- 2026-07-15: Linked the project to Clerk, added auth pages and account controls, and applied Clerk's shadcn theme.
- 2026-07-15: Migrated Clerk authorization away from deprecated middleware path checks and disabled development telemetry.
- 2026-07-15: Implemented Phase 1 user synchronization, signed idempotent webhooks, PostgreSQL-authoritative workspaces and roles, onboarding, workspace switching, authorization tests, and the initial identity migration.
- 2026-07-15: Renamed the application to VCStudio.
- 2026-07-15: Applied the supplied VCStudio logo across public, authentication, and application navigation surfaces.
- 2026-07-15: Added private R2 workspace-logo uploads during onboarding, workspace-scoped object keys, metadata persistence, and bucket cleanup on replacement or deletion.
- 2026-07-15: Corrected workspace onboarding to use an atomic Neon HTTP batch for workspace and owner-membership creation.
- 2026-07-15: Added the retractable shadcn application sidebar and owner-only workspace name and logo management.
- 2026-07-15: Implemented Phase 2 workspace-scoped projects, validated budgets and formats, paginated listing, settings and status transitions, optimistic script drafts, immutable versions, and restore-as-new-version.
- 2026-07-15: Added shadcn project tabs for Script and Settings plus an internally scrollable long-script editor.
- 2026-07-15: Implemented Phase 3 script approval, OpenAI structured scene analysis, Trigger.dev orchestration, usage reservations, immutable scene editing, scene approvals, and the scene-planning migration.
- 2026-07-16: Hardened Phase 3 reservation preflight checks, constrained bulk approval to the active scene plan, moved prompts into `@studio/prompts`, fixed repeated form identifiers, expanded regression tests, and removed high-severity dependency advisories with safe overrides.
- 2026-07-16: Added owner/editor script-version deletion with confirmation, workspace-scoped authorization, protected approved and scene-referenced versions, and soft-deletion audit metadata.
- 2026-07-16: Corrected the scene-analysis trigger button to forward Base UI dialog interaction and accessibility props, allowing the confirmation flow to open and dispatch approved scripts.
- 2026-07-16: Added Trigger.dev run reconciliation, terminal crash handling, reservation release, deterministic analysis retries, and development-worker build isolation for scene analysis.
- 2026-07-16: Replaced the full scene-card list with a responsive two-pane scene workspace featuring search, status filters, previous/next navigation, URL selection, and unsaved-change protection.
- 2026-07-16: Implemented Phase 4 workspace characters, private user-uploaded and dimension-validated R2 references, archive auditing, and scene-version character assignments.
- 2026-07-16: Added strict character JSON import with local-file support and a one-click sample for quickly populating character forms.
- 2026-07-16: Enabled production browser uploads in the R2 CORS policy and added stage-specific character-reference upload diagnostics.
