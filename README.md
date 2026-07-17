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

## Architecture

The application is a TypeScript modular monolith. Next.js owns web routes and server functions, Clerk provides authentication, and Neon PostgreSQL is authoritative for application users, workspaces, memberships, roles, and active-workspace authorization. Database access is isolated in repositories, queries, and commands; authorization policies live outside React components.

The repository will move into the full `apps/` and `packages/` monorepo structure during the broader bootstrap phase. Phase 1 uses the current root Next.js application without introducing a second application structure prematurely.

## Technology stack

Next.js 16, React 19, strict TypeScript, Tailwind CSS, shadcn/ui, Clerk, Neon PostgreSQL, Drizzle ORM, Trigger.dev 4.5.4, OpenAI Responses API, Cloudflare R2, Sharp, Zod, Vitest, ESLint, and Prettier.

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

| Variable                                          | Visibility  | Required    | Purpose                                                           |
| ------------------------------------------------- | ----------- | ----------- | ----------------------------------------------------------------- |
| `APP_NAME`                                        | Server only | Yes         | Human-readable application name (`VCStudio`).                     |
| `NEXT_PUBLIC_APP_URL`                             | Browser     | Yes         | Canonical web application URL.                                    |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Browser     | Yes         | Identifies the Clerk application.                                 |
| `CLERK_SECRET_KEY`                                | Server only | Yes         | Authenticates server-side Clerk operations.                       |
| `CLERK_WEBHOOK_SIGNING_SECRET`                    | Server only | Yes         | Verifies Clerk webhook signatures.                                |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | Browser     | Yes         | Clerk sign-in route.                                              |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | Browser     | Yes         | Clerk sign-up route.                                              |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Browser     | Yes         | Post-sign-in destination.                                         |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Browser     | Yes         | Post-sign-up destination.                                         |
| `DATABASE_URL`                                    | Server only | Yes         | Pooled Neon URL used by application requests.                     |
| `DATABASE_URL_UNPOOLED`                           | Server only | Recommended | Direct Neon URL preferred by migration commands.                  |
| `RUN_DATABASE_INTEGRATION_TESTS`                  | Test only   | No          | Enables mutating integration tests against development Neon only. |
| `NODE_ENV`                                        | Server only | Automatic   | Runtime mode; defaults to `development`.                          |
| `R2_ACCOUNT_ID`                                   | Server only | Yes         | Cloudflare account owning the R2 bucket.                          |
| `R2_ACCESS_KEY_ID`                                | Server only | Yes         | R2 S3 API access key.                                             |
| `R2_SECRET_ACCESS_KEY`                            | Server only | Yes         | R2 S3 API secret key.                                             |
| `R2_BUCKET_NAME`                                  | Server only | Yes         | Private media bucket name.                                        |
| `R2_ENDPOINT`                                     | Server only | Yes         | Account-specific R2 S3 endpoint.                                  |
| `R2_REGION`                                       | Server only | Yes         | R2 region (`auto`).                                               |
| `R2_SIGNED_UPLOAD_EXPIRY_SECONDS`                 | Server only | Yes         | Upload URL lifetime, 60–900 seconds.                              |
| `R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS`               | Server only | Yes         | Download URL lifetime, 60–3600 seconds.                           |
| `MAX_CHARACTER_REFERENCE_SIZE_BYTES`              | Server only | Yes         | Maximum character reference size (`5242880`).                     |
| `ALLOWED_IMAGE_MIME_TYPES`                        | Server only | Yes         | Allowed character image MIME types.                               |
| `MIN_REFERENCE_IMAGE_WIDTH`                       | Server only | Yes         | Minimum character reference width (`512`).                        |
| `MIN_REFERENCE_IMAGE_HEIGHT`                      | Server only | Yes         | Minimum character reference height (`512`).                       |
| `MAX_REFERENCE_IMAGE_WIDTH`                       | Server only | Yes         | Maximum character reference width (`4096`).                       |
| `MAX_REFERENCE_IMAGE_HEIGHT`                      | Server only | Yes         | Maximum character reference height (`4096`).                      |
| `ENABLE_CHARACTER_LIBRARY`                        | Server only | Yes         | Enables the Phase 4 character library.                            |
| `MAX_SCRIPT_CHARACTERS`                           | Server only | Yes         | Maximum narration script length (`50000`).                        |
| `DEFAULT_PROJECT_BUDGET_CENTS`                    | Server only | Yes         | New-project budget ceiling default (`200`).                       |
| `OPENAI_API_KEY`                                  | Server only | Yes         | Authenticates OpenAI Responses API calls.                         |
| `OPENAI_TEXT_MODEL`                               | Server only | Yes         | Configurable structured scene-analysis model.                     |
| `OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS`        | Server only | Yes         | Model input price used for cost controls.                         |
| `OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS`       | Server only | Yes         | Model output price used for cost controls.                        |
| `OPENAI_REQUEST_TIMEOUT_SECONDS`                  | Server only | Yes         | Shared OpenAI request timeout (`180`).                            |
| `OPENAI_IMAGE_MODEL`                              | Server only | Yes         | Image model alias or dated snapshot (`gpt-image-2`).              |
| `OPENAI_IMAGE_DRAFT_QUALITY`                      | Server only | Yes         | Draft quality; Phase 5 requires `low`.                            |
| `OPENAI_IMAGE_FINAL_QUALITY`                      | Server only | Yes         | Final quality; Phase 5 requires `medium`.                         |
| `OPENAI_IMAGE_OUTPUT_FORMAT`                      | Server only | Yes         | Generated image format (`webp` by default).                       |
| `OPENAI_IMAGE_DRAFT_COMPRESSION`                  | Server only | Yes         | Draft WebP/JPEG compression (`80`).                               |
| `OPENAI_IMAGE_FINAL_COMPRESSION`                  | Server only | Yes         | Final WebP/JPEG compression (`90`).                               |
| `OPENAI_IMAGE_BACKGROUND`                         | Server only | Yes         | Opaque or automatic image background.                             |
| `OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS`  | Server only | Yes         | Image-model text-input price (`500`).                             |
| `OPENAI_IMAGE_INPUT_COST_PER_MILLION_CENTS`       | Server only | Yes         | Image-reference input price (`800`).                              |
| `OPENAI_IMAGE_OUTPUT_COST_PER_MILLION_CENTS`      | Server only | Yes         | Generated-image output price (`3000`).                            |
| `OPENAI_IMAGE_LOW_SQUARE_ESTIMATE_CENTS`          | Server only | Yes         | Conservative low-quality square reservation.                      |
| `OPENAI_IMAGE_LOW_RECTANGULAR_ESTIMATE_CENTS`     | Server only | Yes         | Conservative low-quality rectangular reservation.                 |
| `OPENAI_IMAGE_MEDIUM_SQUARE_ESTIMATE_CENTS`       | Server only | Yes         | Conservative medium square reservation.                           |
| `OPENAI_IMAGE_MEDIUM_RECTANGULAR_ESTIMATE_CENTS`  | Server only | Yes         | Conservative medium rectangular reservation.                      |
| `OPENAI_IMAGE_HIGH_SQUARE_ESTIMATE_CENTS`         | Server only | Yes         | Conservative high-quality square reservation.                     |
| `OPENAI_IMAGE_HIGH_RECTANGULAR_ESTIMATE_CENTS`    | Server only | Yes         | Conservative high-quality rectangular reservation.                |
| `OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET`  | Server only | Yes         | Extra reservation per selected reference.                         |
| `MAX_IMAGE_GENERATION_RETRIES`                    | Server only | Yes         | Maximum bounded billable retries (`1`).                           |
| `MAX_REFERENCE_ASSETS_PER_GENERATION`             | Server only | Yes         | Application reference limit, maximum `16`.                        |
| `MAX_REFERENCE_BYTES_PER_GENERATION`              | Server only | Yes         | Aggregate downloaded reference-byte ceiling.                      |
| `MAX_IMAGE_GENERATIONS_PER_SCENE_VERSION`         | Server only | Yes         | Per-version generation and returned-history cap.                  |
| `MAX_IMAGES_PER_BATCH`                            | Server only | Yes         | Maximum scenes per Phase 6 bulk storyboard batch.                 |
| `ENABLE_SCENE_IMAGE_GENERATION`                   | Server only | Yes         | Phase 5/6 generation feature switch.                              |
| `TRIGGER_SECRET_KEY`                              | Server only | Yes         | Authenticates Trigger.dev task submissions.                       |
| `TRIGGER_PROJECT_REF`                             | Server only | Yes         | Identifies the Trigger.dev project.                               |
| `IDEMPOTENCY_HASH_SECRET`                         | Server only | Yes         | HMAC secret for billable-operation identity.                      |
| `REQUEST_FINGERPRINT_SECRET`                      | Server only | Yes         | HMAC secret for prompt request fingerprints.                      |
| `MAX_SCENES_PER_PROJECT`                          | Server only | Yes         | Maximum structured scenes returned per analysis.                  |
| `MIN_SCENE_DURATION_MILLISECONDS`                 | Server only | Yes         | Minimum generated scene duration.                                 |
| `MAX_SCENE_DURATION_MILLISECONDS`                 | Server only | Yes         | Maximum generated scene duration.                                 |
| `MAX_SCENE_ANALYSIS_RETRIES`                      | Server only | Yes         | Maximum bounded text-analysis retries.                            |
| `GENERATION_RESERVATION_EXPIRY_MINUTES`           | Server only | Yes         | Pending AI reservation lifetime (`30`).                           |
| `DEFAULT_DAILY_BUDGET_CENTS`                      | Server only | Yes         | Default workspace daily AI budget.                                |
| `DEFAULT_MONTHLY_BUDGET_CENTS`                    | Server only | Yes         | Default workspace monthly AI budget.                              |

## Database setup

`db/schema.ts` defines application users, workspaces, memberships, projects, scripts, immutable scene versions, characters, immutable style-preset versions, image generations, exact reference snapshots, provider attempts, usage reservations/events, storage metadata, and Clerk webhook delivery records. Generate migrations with `npm run db:generate` and apply reviewed migrations with `npm run db:migrate`. Migration commands prefer `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL` when necessary.

Multi-statement writes use atomic Neon HTTP batches because the Drizzle `neon-http` driver does not support interactive callback transactions.

The initial Phase 1 migration is `migrations/20260715131000_tidy_tinkerer/migration.sql`.
It was applied successfully to the configured development Neon database on 2026-07-15.

The Phase 2 project and script migration is `migrations/20260715162113_warm_misty_knight/migration.sql`. It was applied successfully to the configured development Neon database on 2026-07-15.

The Phase 3 scene-planning migration is `migrations/20260715204954_rainy_umar/migration.sql`. It was applied successfully to the configured development Neon database on 2026-07-15.

The script-version deletion audit migration is `migrations/20260715222820_absurd_yellowjacket/migration.sql`. It adds soft-deletion actor and timestamp fields to script versions and was applied successfully to the configured development Neon database on 2026-07-16.

The Phase 4 character-library migration is `migrations/20260716185811_bumpy_thunderbolts/migration.sql`. It adds workspace characters, private reference metadata, destructive-operation audit records, and scene-version character assignments. It was applied successfully to the configured development Neon database on 2026-07-16.

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

## Storage setup

Workspace-logo storage uses a private Cloudflare R2 bucket. Objects use workspace-scoped keys such as `workspaces/{workspaceId}/branding/logos/{assetId}.png`; PostgreSQL stores metadata and ownership rather than image bytes or permanent public URLs.

Character references use keys such as `workspaces/{workspaceId}/characters/{characterId}/references/{referenceType}/{assetId}.webp`. Completion downloads the private object and uses Sharp to verify its real format and dimensions before persisting metadata. Core identity views replace their prior object; expression, outfit, and pose references allow multiple images. Deleting or replacing a reference removes its R2 object.

Generated scene images use deterministic keys such as `workspaces/{workspaceId}/projects/{projectId}/scenes/{sceneId}/versions/{sceneVersionId}/images/{generationId}.webp`. The Trigger.dev task verifies the generated bytes and dimensions before upload, stores recovery metadata on the private R2 object, and exposes images only through an authorized short-lived download route. Exact selected character-reference asset identifiers and immutable object metadata are retained with each generation record.

Configure the bucket CORS policy to allow `PUT` from every browser origin that uploads directly to R2, including `http://localhost:3000` and the stable production origin `https://vcstudio.vercel.app`, with the `Content-Type` header. Deployment-specific preview URLs must be added explicitly before uploads will work from previews. Upload URLs expire according to `R2_SIGNED_UPLOAD_EXPIRY_SECONDS`; private logo display uses short-lived signed download URLs. Logo uploads accept PNG, JPEG, and WebP files up to 5 MB. Replacing or deleting a logo removes the superseded R2 object.

## OpenAI setup

Set `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, and the text model's input/output price variables. Scene analysis uses the Responses API with Zod-backed structured output. For the configured `gpt-5.6-luna` model, the documented July 2026 rates are represented as `100` input cents and `600` output cents per million tokens. Update both the model and its pricing variables together when changing models.

Phase 5 uses the configurable `OPENAI_IMAGE_MODEL` provider default (`gpt-image-2`) with the Images API. Requests without references use image generation; requests with references use image editing and GPT Image 2's automatic high-fidelity reference handling. Only the API-supported `1536x1024`, `1024x1536`, and `1024x1024` sizes are accepted. Drafts default to low quality and 80% WebP compression; finals default to medium quality and 90% compression. High quality is an explicit per-request choice. Store the model and pricing configuration with each deployment so a dated model snapshot can be selected later without a code change.

## Rendering setup

Not implemented yet. Remotion, FFmpeg, and FFprobe are planned.

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

Tests cover authentication gating, environment validation, workspace role permissions, nonmember rejection, cross-workspace isolation, project and budget validation, pagination limits, project status transitions, script statistics, scene structured output, prompt determinism and versioning, image-reference ordering and isolation, idempotency, cost estimation and reconciliation, budget reservation, retry limits, provider failure classification, R2 upload and recovery keys, scene timing, character slugs and archival behavior, reference dimensions and storage keys, upload sequencing, Clerk user deletion routing, and opt-in concurrent PostgreSQL checks for Phase 5 terminal state, approval, and tenant invariants.

The database integration suite is skipped by default. Run it only against a development Neon database after applying reviewed migrations. Each run creates UUID-isolated fixtures and removes them through their workspace parent cascade; it never calls OpenAI, R2, or Trigger.dev.

## Deployment

Set every required environment variable in the deployment environment. The Phase 5 OpenAI image, R2, budget, fingerprint, reservation, and retry variables must be present in both Vercel and Trigger.dev because the web application creates reservations while the worker executes and reconciles them. Configure a production Clerk webhook endpoint separately from development, apply migrations before promoting dependent application code, and deploy the Trigger.dev task with `npm run trigger:deploy`.

## Security model

Clerk authenticates sessions; PostgreSQL authorizes application access. Every protected server resource calls Clerk protection and then resolves the local user. A workspace ID from a cookie or form is only a preference and is never trusted: every workspace operation queries membership by both `userId` and `workspaceId`. Workspace creation and initial ownership are transactional. Webhooks are verified before parsing, deduplicated by Svix delivery ID, and store only safe failure summaries.

Deleted Clerk users are soft-deleted and anonymized locally so workspace ownership and audit relationships remain intact. Script-version deletion is restricted to owners and editors, scoped by the authenticated workspace, and records the deleting user and timestamp.

Scene-image configuration, generation history, reference selection, asset delivery, approval, and rejection are authorized by workspace-scoped project and scene identifiers resolved on the server. Composite foreign keys also prevent Phase 5 generation, reference, provider-attempt, reservation, and usage-event rows from crossing workspace or project boundaries. Only owners and editors can generate or review images. Private reference and generated-image objects are never exposed as permanent public URLs.

## Cost controls

Scene analysis and scene-image generation show a conservative estimate before confirmation. Their reservation commands serialize spending checks per workspace, enforce project plus daily and monthly workspace limits atomically, and append application-level ledger events. Image generation records each provider attempt and actual token usage, reconciles the reservation to actual cost, releases unused value, and uses a conservative reserved-cost fallback when usage is unavailable. Every explicit Generate action creates a new paid generation version; billable retries are bounded by `MAX_IMAGE_GENERATION_RETRIES` and never silently reuse an older image.

## Current limitations

- Invitations and billing are intentionally excluded from Phase 1.
- Workspace membership management UI is not implemented yet.
- `CLERK_WEBHOOK_SIGNING_SECRET` must be configured before real webhook delivery can succeed.
- The Phase 1 migration must still be applied separately to future preview and production databases.
- Full browser end-to-end coverage will be expanded with the bootstrap Playwright foundation.
- Audio generation, subtitles, and rendering are not implemented yet.
- Phase 5 generates one scene image per confirmed request. Batch generation and a workspace style-preset editor are deferred; the immutable seeded preset and generation history are available now.
- Remotion crop/fit behavior for translating OpenAI's supported image sizes to final video dimensions will be added with rendering.
- Script version history is currently bounded to the latest 50 versions in the editor.
- Approved script versions and versions referenced by scene analysis are retained and cannot be deleted.
- Trigger.dev must be running locally or deployed before queued scene analyses or image generations execute.
- Safe npm overrides pin vulnerable `ws` and `cookie` transitive dependencies to patched releases. The dependency tree currently retains 32 moderate transitive advisories in Trigger.dev OpenTelemetry/esbuild, Next.js PostCSS, and Clerk UI dependency chains. The development-only Trigger.dev CLI adds four high `tar` advisories; npm currently offers only breaking forced downgrades rather than compatible remediations.

## Implementation status

Phases 1–6 are implemented through authenticated workspaces, project/script versioning, durable AI scene planning, workspace character consistency references, cost-controlled single-scene image generation and review, and the storyboard with controlled bulk image generation. Audio, subtitles, and rendering remain future phases.

## Recent major changes

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
