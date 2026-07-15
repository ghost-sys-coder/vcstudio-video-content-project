# You are bootstrapping the AI video production platform described in `AGENTS.md`

Read `AGENTS.md` completely before doing anything. Treat every rule inside it as mandatory.

## Objective

Create a production grade monorepo foundation for an application that converts scripts into scenes, generates scene images and narration, manages human approval, and renders videos.

This task creates infrastructure and foundations only. Do not implement the complete product.

## Required stack

Use:

```text
pnpm workspaces
Turborepo
Next.js App Router
React
TypeScript
Tailwind CSS
shadcn/ui
Clerk
Neon PostgreSQL
Drizzle ORM
Trigger.dev
OpenAI Node SDK
Cloudflare R2 through the AWS S3 compatible SDK
Remotion
FFmpeg
FFprobe
Zod
Sentry
PostHog
Vitest
Playwright
ESLint
Prettier
```

Use current stable package versions that are mutually compatible. Inspect official package requirements before choosing versions. Do not use release candidates, beta versions, or canary versions unless a required integration has no stable release.

## Repository structure

Create:

```text
apps/
  web/
  renderer/

packages/
  auth/
  config/
  contracts/
  database/
  domain/
  media/
  observability/
  openai/
  prompts/
  storage/
  test-utils/

trigger/
  tasks/
  queues/
  utilities/

drizzle/
docs/
```

Each package must have a clear responsibility and valid package exports.

Configure TypeScript project references or workspace resolution so imports use package aliases rather than deep relative paths.

Suggested aliases:

```text
@studio/auth
@studio/config
@studio/contracts
@studio/database
@studio/domain
@studio/media
@studio/observability
@studio/openai
@studio/prompts
@studio/storage
@studio/test-utils
```

## Applications

### apps/web

Create a Next.js App Router application with:

```text
TypeScript strict mode
Tailwind CSS
ESLint
App Router
src directory
server components by default
Clerk integration foundation
Sentry foundation
PostHog foundation
secure headers foundation
health route
authenticated application layout placeholder
public landing page placeholder
```

Required initial routes:

```text
/
 /sign-in
 /sign-up
 /app
 /api/health
```

Use Clerk catch all routes according to the current Clerk Next.js integration.

The authenticated application shell must verify authentication on the server.

Create a minimal dashboard placeholder. Do not implement project features yet.

Apply the one component per file and PascalCase filename rules.

Keep `page.tsx` and `layout.tsx` thin.

### apps/renderer

Create a Remotion application containing:

```text
Root composition registration
Basic static image composition
Typed render input schema
Renderer command entry point
Render input validation
Simple smoke test
```

The renderer should accept a typed timeline object from `@studio/contracts`.

Do not add final video templates yet.

## Shared packages

### packages/config

Implement server environment validation with Zod.

Separate:

```text
shared environment values
web server environment values
web public environment values
Trigger.dev environment values
renderer environment values
```

The application must fail early with a clear message when required environment values are missing.

Do not expose server secrets through `NEXT_PUBLIC_` variables.

### packages/contracts

Create foundational schemas and types for:

```text
UserIdentifier
WorkspaceIdentifier
ProjectIdentifier
SceneIdentifier
AssetIdentifier
WorkflowRunIdentifier
AspectRatio
VideoResolution
FrameRate
ProjectStatus
SceneStatus
AssetType
GenerationStatus
RenderStatus
VideoTimeline
VideoTimelineScene
CameraMotion
TransitionType
```

Use Zod schemas and inferred TypeScript types.

Use discriminated unions where suitable.

### packages/database

Configure Drizzle for Neon PostgreSQL.

Provide:

```text
database client
transaction helper
schema exports
migration configuration
test database configuration placeholder
```

Use a pooled Neon connection for normal serverless application access.

Do not implement the full schema in this task.

Create the initial identity schema:

```text
users
workspaces
workspaceMembers
```

Required user fields:

```text
id
clerkUserId
email
displayName
avatarUrl
createdAt
updatedAt
```

Required workspace fields:

```text
id
name
slug
createdByUserId
createdAt
updatedAt
```

Required workspace member fields:

```text
id
workspaceId
userId
role
createdAt
updatedAt
```

Roles:

```text
owner
editor
viewer
```

Add unique constraints and ownership indexes.

Create and generate the initial migration.

### packages/auth

Create server authorization helpers:

```text
requireAuthenticatedUser
synchronizeAuthenticatedUser
requireWorkspaceMembership
requireWorkspaceRole
canCreateProject
canEditProject
canGenerateAssets
canRenderProject
canManageWorkspace
```

Do not trust client supplied roles.

Do not place authorization logic in React components.

Use centralized typed authorization errors.

### packages/openai

Create an OpenAI client factory that:

```text
is server only
uses validated environment values
does not instantiate clients in React components
supports dependency injection for testing
does not implement generation operations yet
```

### packages/storage

Create a Cloudflare R2 client foundation using the AWS S3 compatible SDK.

Implement:

```text
private bucket client
object key validation
workspace scoped object key builder
signed upload URL helper
signed download URL helper
content type allowlist
maximum upload size constants
```

Do not create upload user interfaces yet.

### packages/prompts

Create:

```text
prompt template interface
prompt version type
prompt registry foundation
placeholder template test
```

Do not add complete production prompts yet.

### packages/media

Create wrappers for:

```text
FFmpeg process execution
FFprobe metadata inspection
safe argument construction
typed media metadata
```

Never use shell string concatenation.

Detect missing FFmpeg or FFprobe binaries and provide actionable errors.

### packages/observability

Configure typed logging helpers and Sentry initialization boundaries.

Create a function for removing sensitive values from logged metadata.

### packages/domain

Create domain errors, result utilities, state transition helpers, and identifiers.

### packages/test-utils

Create reusable test factories and test environment utilities.

## Trigger.dev

Initialize Trigger.dev using its current stable Next.js and monorepo setup.

Create these queue declarations:

```text
ai-text
image-generation
audio-generation
media-processing
video-rendering
```

Use conservative initial concurrency values:

```text
ai-text: 5
image-generation: 2
audio-generation: 3
media-processing: 2
video-rendering: 1
```

Create one non billable health test task that:

1. Accepts a Zod validated payload.
2. Writes structured progress.
3. Returns a typed result.
4. Does not call OpenAI.
5. Can be triggered from an authenticated server action available only in development.

Do not expose Trigger.dev secret keys to the browser.

## Dependencies

Install the packages required for the implementation. The exact package names may change based on current stable documentation, but the expected dependency categories include:

### Root development dependencies

```text
turbo
typescript
eslint
prettier
prettier-plugin-tailwindcss
vitest
@vitest/coverage-v8
tsx
dotenv-cli
```

### Web dependencies

```text
next
react
react-dom
@clerk/nextjs
zod
server-only
@sentry/nextjs
posthog-js
posthog-node
react-hook-form
@hookform/resolvers
sonner
lucide-react
class-variance-authority
clsx
tailwind-merge
```

Add shadcn/ui through its current CLI workflow rather than installing a fake umbrella component package.

### Database dependencies

```text
drizzle-orm
drizzle-kit
@neondatabase/serverless
postgres
```

Use only the database drivers genuinely needed. Do not ship duplicate runtime database strategies without documenting why.

### OpenAI dependency

```text
openai
```

### Storage dependencies

```text
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

### Trigger.dev dependencies

Use the current stable Trigger.dev packages required by its official initialization process.

### Renderer dependencies

```text
remotion
@remotion/renderer
@remotion/bundler
zod
```

Add other Remotion packages only when a feature requires them.

### Testing dependencies

```text
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
jsdom
@playwright/test
```

### Utilities

```text
nanoid
date-fns
```

Do not install a utility library unless it is used.

## Environment variables

Create `.env.example` without real secret values.

Implement validation for the following variables.

### Core application

```dotenv
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_NAME=AI Video Studio
LOG_LEVEL=info
```

### Clerk

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/app
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/app
CLERK_WEBHOOK_SECRET=
```

### Database

```dotenv
DATABASE_URL=
DATABASE_URL_UNPOOLED=
```

Use the pooled value for application runtime. Use the direct or unpooled value for migrations when required.

### OpenAI

```dotenv
OPENAI_API_KEY=
OPENAI_ORGANIZATION_ID=
OPENAI_PROJECT_ID=
OPENAI_TEXT_MODEL=
OPENAI_IMAGE_MODEL=
OPENAI_TTS_MODEL=
OPENAI_TTS_VOICE=
```

Treat organization and project identifiers as optional unless the current OpenAI SDK or account configuration requires them.

Do not assume ChatGPT Pro provides API billing. The product must use a separately funded API account.

### Trigger.dev environment variables

```dotenv
TRIGGER_SECRET_KEY=
TRIGGER_PROJECT_REF=
TRIGGER_PREVIEW_BRANCH=
```

Treat preview branch as optional outside preview deployments.

### Cloudflare R2

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_ENDPOINT=
R2_SIGNED_URL_EXPIRY_SECONDS=900
```

Do not add a public R2 URL because the bucket should remain private.

### Remotion and media

```dotenv
REMOTION_SERVE_URL=
REMOTION_RENDER_OUTPUT_DIRECTORY=.render-output
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
RENDER_DEFAULT_FPS=30
RENDER_MAX_DURATION_SECONDS=900
RENDER_CONCURRENCY=1
```

Treat `REMOTION_SERVE_URL` as optional for local rendering when bundling locally.

### Sentry

```dotenv
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_ENVIRONMENT=development
```

### PostHog

```dotenv
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_PERSONAL_API_KEY=
```

Treat the personal API key as optional until server management operations need it.

### Security and limits

```dotenv
SIGNED_URL_EXPIRY_SECONDS=900
MAX_UPLOAD_SIZE_BYTES=20971520
MAX_SCRIPT_CHARACTERS=50000
MAX_SCENES_PER_PROJECT=200
MAX_IMAGES_PER_BATCH=25
MAX_VARIANTS_PER_SCENE=4
MAX_GENERATION_RETRIES=2
DEFAULT_DAILY_BUDGET_CENTS=500
DEFAULT_MONTHLY_BUDGET_CENTS=5000
DEFAULT_PROJECT_BUDGET_CENTS=1000
```

### Testing

```dotenv
TEST_DATABASE_URL=
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

Document which environment variables are required, optional, server only, or browser visible.

Ensure `.env.local`, `.env`, `.env.production`, and secret files are ignored by Git.

## Package scripts

Create useful root scripts:

```json
{
  "dev": "turbo dev",
  "build": "turbo build",
  "lint": "turbo lint",
  "typecheck": "turbo typecheck",
  "test": "turbo test",
  "test:coverage": "turbo test:coverage",
  "test:e2e": "playwright test",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "db:generate": "pnpm --filter @studio/database db:generate",
  "db:migrate": "pnpm --filter @studio/database db:migrate",
  "db:studio": "pnpm --filter @studio/database db:studio",
  "trigger:dev": "trigger.dev dev",
  "trigger:deploy": "trigger.dev deploy",
  "render:smoke": "pnpm --filter @studio/renderer render:smoke",
  "verify": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build"
}
```

Adjust syntax to the actual package configuration.

## Continuous integration

Create a GitHub Actions workflow that runs:

```text
pnpm install with frozen lockfile
format check
lint
typecheck
unit tests
production build
```

Do not run deployment from this workflow yet.

Use dependency caching.

## Security headers

Add sensible defaults for:

```text
Content Security Policy foundation
Referrer Policy
Permissions Policy
X Content Type Options
frame ancestor restrictions
Strict Transport Security in production
```

Ensure Clerk, Sentry, PostHog, and required asset domains remain functional.

Document any relaxed policy.

## README

Create a comprehensive `README.md` containing:

```text
Project overview
Current scope
Architecture
Technology stack
Repository structure
Prerequisites
Local setup
Environment variables
Database setup
Clerk setup
Trigger.dev setup
Cloudflare R2 setup
OpenAI API setup
FFmpeg setup
Remotion setup
Development commands
Testing commands
Deployment overview
Security model
Cost control foundation
Current implementation status
Current limitations
Recent major changes
```

Add a dated bootstrap entry under `Recent major changes`.

## Tests

Add meaningful tests for:

```text
environment variable validation
workspace role validation
authorization policy foundations
object key validation
signed URL configuration validation
timeline schema validation
safe media argument construction
domain state helpers
```

Do not use meaningless placeholder tests.

## Completion requirements

Before finishing:

1. Install dependencies.
2. Generate the lockfile.
3. Generate the initial database migration.
4. Run formatting.
5. Run linting.
6. Run TypeScript checking.
7. Run unit tests.
8. Run the production build.
9. Run the renderer smoke test if the environment supports it.
10. Inspect the repository for React component rule violations.
11. Verify `.env.example`.
12. Update `README.md`.
13. Report all commands and their actual results.

Do not begin project, scene, generation, or rendering feature implementation beyond the foundations explicitly requested.
