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

## Architecture

The application is a TypeScript modular monolith. Next.js owns web routes and server functions, Clerk provides authentication, and Neon PostgreSQL is authoritative for application users, workspaces, memberships, roles, and active-workspace authorization. Database access is isolated in repositories, queries, and commands; authorization policies live outside React components.

The repository will move into the full `apps/` and `packages/` monorepo structure during the broader bootstrap phase. Phase 1 uses the current root Next.js application without introducing a second application structure prematurely.

## Technology stack

Next.js 16, React 19, strict TypeScript, Tailwind CSS, shadcn/ui, Clerk, Neon PostgreSQL, Drizzle ORM, Zod, Vitest, ESLint, and Prettier.

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
migrations/          Generated immutable SQL migrations
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

## Database setup

`db/schema.ts` defines application users, workspaces, workspace memberships, and Clerk webhook delivery records. Generate migrations with `npm run db:generate` and apply reviewed migrations with `npm run db:migrate`. Migration commands prefer `DATABASE_URL_UNPOOLED` and fall back to `DATABASE_URL` when necessary.

Multi-statement writes use atomic Neon HTTP batches because the Drizzle `neon-http` driver does not support interactive callback transactions.

The initial Phase 1 migration is `migrations/20260715131000_tidy_tinkerer/migration.sql`.
It was applied successfully to the configured development Neon database on 2026-07-15.

## Clerk setup

Configure Clerk with `/sign-in` and `/sign-up`, then create a webhook endpoint targeting `/api/webhooks/clerk`. Subscribe to:

- `user.created`
- `user.updated`
- `user.deleted`

Copy the endpoint signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`. Workspace roles are not sourced from Clerk Organizations; PostgreSQL membership rows are authoritative.

## Trigger.dev setup

Not implemented yet.

## Storage setup

Workspace-logo storage uses a private Cloudflare R2 bucket. Objects use workspace-scoped keys such as `workspaces/{workspaceId}/branding/logos/{assetId}.png`; PostgreSQL stores metadata and ownership rather than image bytes or permanent public URLs.

Configure the bucket CORS policy to allow `PUT` from `NEXT_PUBLIC_APP_URL` with the `Content-Type` header. Upload URLs expire according to `R2_SIGNED_UPLOAD_EXPIRY_SECONDS`; private logo display uses short-lived signed download URLs. Logo uploads accept PNG, JPEG, and WebP files up to 5 MB. Replacing or deleting a logo removes the superseded R2 object.

## OpenAI setup

Not implemented yet.

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

## Testing commands

- `npm test` runs Vitest once.
- `npm run test:coverage` runs tests with V8 coverage.

Phase 1 tests cover authentication gating, environment validation, workspace role permissions, nonmember rejection, cross-workspace isolation, and Clerk user deletion routing.

## Deployment

Set every required environment variable in the deployment environment. Configure a production Clerk webhook endpoint separately from development and apply migrations before promoting application code that depends on them.

## Security model

Clerk authenticates sessions; PostgreSQL authorizes application access. Every protected server resource calls Clerk protection and then resolves the local user. A workspace ID from a cookie or form is only a preference and is never trusted: every workspace operation queries membership by both `userId` and `workspaceId`. Workspace creation and initial ownership are transactional. Webhooks are verified before parsing, deduplicated by Svix delivery ID, and store only safe failure summaries.

Deleted Clerk users are soft-deleted and anonymized locally so workspace ownership and audit relationships remain intact.

## Cost controls

Billable AI and rendering operations are not implemented yet. Budget reservations and usage reconciliation remain required before those providers are enabled.

## Current limitations

- Invitations and billing are intentionally excluded from Phase 1.
- Workspace membership management UI is not implemented yet.
- `CLERK_WEBHOOK_SIGNING_SECRET` must be configured before real webhook delivery can succeed.
- The Phase 1 migration must still be applied separately to future preview and production databases.
- Full browser end-to-end coverage will be expanded with the bootstrap Playwright foundation.

## Implementation status

Phase 1 authentication, user synchronization, workspace onboarding, and authorization foundations are implemented. Project and generation features remain out of scope.

## Recent major changes

- 2026-07-15: Linked the project to Clerk, added auth pages and account controls, and applied Clerk's shadcn theme.
- 2026-07-15: Migrated Clerk authorization away from deprecated middleware path checks and disabled development telemetry.
- 2026-07-15: Implemented Phase 1 user synchronization, signed idempotent webhooks, PostgreSQL-authoritative workspaces and roles, onboarding, workspace switching, authorization tests, and the initial identity migration.
- 2026-07-15: Renamed the application to VCStudio.
- 2026-07-15: Applied the supplied VCStudio logo across public, authentication, and application navigation surfaces.
- 2026-07-15: Added private R2 workspace-logo uploads during onboarding, workspace-scoped object keys, metadata persistence, and bucket cleanup on replacement or deletion.
- 2026-07-15: Corrected workspace onboarding to use an atomic Neon HTTP batch for workspace and owner-membership creation.
- 2026-07-15: Added the retractable shadcn application sidebar and owner-only workspace name and logo management.
