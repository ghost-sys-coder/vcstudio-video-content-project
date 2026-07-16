# VCStudio

## Project overview

This repository is the foundation for an internal production tool that converts narration scripts into structured scenes, generated media, synchronized timelines, and rendered videos.

## Current capabilities

- Public landing page and shared Clerk sign-in/sign-up presentation.
- Lazy Clerk user synchronization into PostgreSQL.
- Signed, idempotent Clerk user lifecycle webhook processing.
- First-workspace onboarding with transactional owner membership creation.
- Authenticated application shell, workspace selector, user account menu, dashboard placeholder, and access-denied state.
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

| Variable                                          | Visibility  | Required    | Purpose                                          |
| ------------------------------------------------- | ----------- | ----------- | ------------------------------------------------ |
| `APP_NAME`                                        | Server only | Yes         | Human-readable application name (`VCStudio`).    |
| `NEXT_PUBLIC_APP_URL`                             | Browser     | Yes         | Canonical web application URL.                   |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Browser     | Yes         | Identifies the Clerk application.                |
| `CLERK_SECRET_KEY`                                | Server only | Yes         | Authenticates server-side Clerk operations.      |
| `CLERK_WEBHOOK_SIGNING_SECRET`                    | Server only | Yes         | Verifies Clerk webhook signatures.               |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`                   | Browser     | Yes         | Clerk sign-in route.                             |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`                   | Browser     | Yes         | Clerk sign-up route.                             |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Browser     | Yes         | Post-sign-in destination.                        |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Browser     | Yes         | Post-sign-up destination.                        |
| `DATABASE_URL`                                    | Server only | Yes         | Pooled Neon URL used by application requests.    |
| `DATABASE_URL_UNPOOLED`                           | Server only | Recommended | Direct Neon URL preferred by migration commands. |
| `R2_ACCOUNT_ID`                                   | Server only | Yes         | Cloudflare account owning the R2 bucket.         |
| `R2_ACCESS_KEY_ID`                                | Server only | Yes         | R2 S3 API access key.                            |
| `R2_SECRET_ACCESS_KEY`                            | Server only | Yes         | R2 S3 API secret key.                            |
| `R2_BUCKET_NAME`                                  | Server only | Yes         | Private media bucket name.                       |
| `R2_ENDPOINT`                                     | Server only | Yes         | Account-specific R2 S3 endpoint.                 |
| `R2_REGION`                                       | Server only | Yes         | R2 region (`auto`).                              |
| `R2_SIGNED_UPLOAD_EXPIRY_SECONDS`                 | Server only | Yes         | Upload URL lifetime, 60–900 seconds.             |
| `R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS`               | Server only | Yes         | Download URL lifetime, 60–3600 seconds.          |
| `MAX_CHARACTER_REFERENCE_SIZE_BYTES`              | Server only | Yes         | Maximum character reference size (`5242880`).    |
| `ALLOWED_IMAGE_MIME_TYPES`                        | Server only | Yes         | Allowed character image MIME types.              |
| `MIN_REFERENCE_IMAGE_WIDTH`                       | Server only | Yes         | Minimum character reference width (`512`).       |
| `MIN_REFERENCE_IMAGE_HEIGHT`                      | Server only | Yes         | Minimum character reference height (`512`).      |
| `MAX_REFERENCE_IMAGE_WIDTH`                       | Server only | Yes         | Maximum character reference width (`4096`).      |
| `MAX_REFERENCE_IMAGE_HEIGHT`                      | Server only | Yes         | Maximum character reference height (`4096`).     |
| `ENABLE_CHARACTER_LIBRARY`                        | Server only | Yes         | Enables the Phase 4 character library.           |
| `MAX_SCRIPT_CHARACTERS`                           | Server only | Yes         | Maximum narration script length (`50000`).       |
| `DEFAULT_PROJECT_BUDGET_CENTS`                    | Server only | Yes         | New-project budget ceiling default (`200`).      |
| `OPENAI_API_KEY`                                  | Server only | Yes         | Authenticates OpenAI Responses API calls.        |
| `OPENAI_TEXT_MODEL`                               | Server only | Yes         | Configurable structured scene-analysis model.    |
| `OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS`        | Server only | Yes         | Model input price used for cost controls.        |
| `OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS`       | Server only | Yes         | Model output price used for cost controls.       |
| `TRIGGER_SECRET_KEY`                              | Server only | Yes         | Authenticates Trigger.dev task submissions.      |
| `TRIGGER_PROJECT_REF`                             | Server only | Yes         | Identifies the Trigger.dev project.              |
| `IDEMPOTENCY_HASH_SECRET`                         | Server only | Yes         | HMAC secret for billable-operation identity.     |
| `REQUEST_FINGERPRINT_SECRET`                      | Server only | Yes         | HMAC secret for prompt request fingerprints.     |
| `MAX_SCENES_PER_PROJECT`                          | Server only | Yes         | Maximum structured scenes returned per analysis. |
| `DEFAULT_DAILY_BUDGET_CENTS`                      | Server only | Yes         | Default workspace daily AI budget.               |
| `DEFAULT_MONTHLY_BUDGET_CENTS`                    | Server only | Yes         | Default workspace monthly AI budget.             |

## Database setup

`db/schema.ts` defines application users, workspaces, memberships, projects, script drafts, immutable script versions, storage metadata, and Clerk webhook delivery records. Generate migrations with `npm run db:generate` and apply reviewed migrations with `npm run db:migrate`. Migration commands prefer `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL` when necessary.

Multi-statement writes use atomic Neon HTTP batches because the Drizzle `neon-http` driver does not support interactive callback transactions.

The initial Phase 1 migration is `migrations/20260715131000_tidy_tinkerer/migration.sql`.
It was applied successfully to the configured development Neon database on 2026-07-15.

The Phase 2 project and script migration is `migrations/20260715162113_warm_misty_knight/migration.sql`. It was applied successfully to the configured development Neon database on 2026-07-15.

The Phase 3 scene-planning migration is `migrations/20260715204954_rainy_umar/migration.sql`. It was applied successfully to the configured development Neon database on 2026-07-15.

The script-version deletion audit migration is `migrations/20260715222820_absurd_yellowjacket/migration.sql`. It adds soft-deletion actor and timestamp fields to script versions and was applied successfully to the configured development Neon database on 2026-07-16.

The Phase 4 character-library migration is `migrations/20260716185811_bumpy_thunderbolts/migration.sql`. It adds workspace characters, private reference metadata, destructive-operation audit records, and scene-version character assignments. It was applied successfully to the configured development Neon database on 2026-07-16.

## Clerk setup

Configure Clerk with `/sign-in` and `/sign-up`, then create a webhook endpoint targeting `/api/webhooks/clerk`. Subscribe to:

- `user.created`
- `user.updated`
- `user.deleted`

Copy the endpoint signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`. Workspace roles are not sourced from Clerk Organizations; PostgreSQL membership rows are authoritative.

## Trigger.dev setup

Phase 3 defines the `scene-analysis` task in the shared `ai-text` queue. Add all Phase 3 server variables to the Trigger.dev environment, run `npm run trigger:dev` alongside Next.js for local task execution, and deploy with `npm run trigger:deploy`. Before invoking OpenAI, the task validates reservation ownership, status, expiry, amount, and prompt fingerprint. It also uses bounded retries, validates idempotency and the approved script version, writes scenes atomically, and reconciles usage reservations. The web application retrieves active Trigger run status while polling so crashes, cancellations, and system failures release reservations and become retryable application failures instead of remaining queued indefinitely.

## Storage setup

Workspace-logo storage uses a private Cloudflare R2 bucket. Objects use workspace-scoped keys such as `workspaces/{workspaceId}/branding/logos/{assetId}.png`; PostgreSQL stores metadata and ownership rather than image bytes or permanent public URLs.

Character references use keys such as `workspaces/{workspaceId}/characters/{characterId}/references/{referenceType}/{assetId}.webp`. Completion downloads the private object and uses Sharp to verify its real format and dimensions before persisting metadata. Core identity views replace their prior object; expression, outfit, and pose references allow multiple images. Deleting or replacing a reference removes its R2 object.

Configure the bucket CORS policy to allow `PUT` from `NEXT_PUBLIC_APP_URL` with the `Content-Type` header. Upload URLs expire according to `R2_SIGNED_UPLOAD_EXPIRY_SECONDS`; private logo display uses short-lived signed download URLs. Logo uploads accept PNG, JPEG, and WebP files up to 5 MB. Replacing or deleting a logo removes the superseded R2 object.

## OpenAI setup

Set `OPENAI_API_KEY`, `OPENAI_TEXT_MODEL`, and the model's input/output price variables. Scene analysis uses the Responses API with Zod-backed structured output. For the configured `gpt-5.6-luna` model, the documented July 2026 rates are represented as `100` input cents and `600` output cents per million tokens. Update both the model and its pricing variables together when changing models.

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

Tests cover authentication gating, environment validation, workspace role permissions, nonmember rejection, cross-workspace isolation, project and budget validation, pagination limits, project status transitions, script statistics, scene structured output, prompt determinism, idempotency, cost calculations, scene timing, character slugs and archival behavior, reference dimensions and storage keys, upload sequencing, and Clerk user deletion routing.

## Deployment

Set every required environment variable in the deployment environment. Configure a production Clerk webhook endpoint separately from development and apply migrations before promoting application code that depends on them.

## Security model

Clerk authenticates sessions; PostgreSQL authorizes application access. Every protected server resource calls Clerk protection and then resolves the local user. A workspace ID from a cookie or form is only a preference and is never trusted: every workspace operation queries membership by both `userId` and `workspaceId`. Workspace creation and initial ownership are transactional. Webhooks are verified before parsing, deduplicated by Svix delivery ID, and store only safe failure summaries.

Deleted Clerk users are soft-deleted and anonymized locally so workspace ownership and audit relationships remain intact. Script-version deletion is restricted to owners and editors, scoped by the authenticated workspace, and records the deleting user and timestamp.

## Cost controls

Scene analysis estimates cost before confirmation, enforces project plus workspace daily/monthly limits, creates a pending reservation, records provider usage, and reconciles or releases the reservation. Image, audio, and rendering operations remain disabled until they implement the same lifecycle.

## Current limitations

- Invitations and billing are intentionally excluded from Phase 1.
- Workspace membership management UI is not implemented yet.
- `CLERK_WEBHOOK_SIGNING_SECRET` must be configured before real webhook delivery can succeed.
- The Phase 1 migration must still be applied separately to future preview and production databases.
- Full browser end-to-end coverage will be expanded with the bootstrap Playwright foundation.
- Image generation, audio generation, subtitles, and rendering are not implemented yet. Phase 5 will snapshot the exact character reference asset identifiers used by each image generation.
- Script version history is currently bounded to the latest 50 versions in the editor.
- Approved script versions and versions referenced by scene analysis are retained and cannot be deleted.
- Trigger.dev must be running locally or deployed before queued scene analyses execute.
- Safe npm overrides pin vulnerable `ws` and `cookie` transitive dependencies to patched releases. The dependency tree currently retains 32 moderate transitive advisories in Trigger.dev OpenTelemetry/esbuild, Next.js PostCSS, and Clerk UI dependency chains. The development-only Trigger.dev CLI adds four high `tar` advisories; npm currently offers only breaking forced downgrades rather than compatible remediations.

## Implementation status

Phases 1–4 are implemented through authenticated workspaces, project/script versioning, durable AI scene planning, and workspace character consistency references. Media generation and rendering remain future phases.

## Recent major changes

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
