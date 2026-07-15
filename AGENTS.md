# AGENTS.md

## Project identity

This repository contains an AI assisted video production platform that converts narration scripts into structured scenes, consistent scene images, narration audio, subtitles, timelines, and rendered videos.

The first release is an internal production tool. The architecture must support future workspace collaboration and SaaS billing without implementing unnecessary SaaS features during the MVP.

## Mandatory execution process

Before changing code:

1. Read this entire file.
2. Read `README.md`.
3. Inspect the current repository structure.
4. Inspect the relevant database schema, types, tests, and existing implementation.
5. State the files that will probably change.
6. Do not make assumptions when the repository already contains the answer.

After changing code:

1. Run formatting.
2. Run linting.
3. Run TypeScript checking.
4. Run relevant unit tests.
5. Run relevant integration tests.
6. Run the production build when the change affects compilation, routing, configuration, database access, or deployment.
7. Review the changed files for violations of this document.
8. Update `README.md`.
9. Provide a completion report containing:

   1. What changed.
   2. Important architectural decisions.
   3. Tests executed.
   4. Test results.
   5. Database migrations created.
   6. Environment variables added or changed.
   7. Known limitations.
   8. The next recommended action.

Never claim that a command passed unless it was executed successfully.

## Strict React component rules

These rules are absolute.

### One component per file

Every React component must live in its own file.

This applies to:

1. Page specific components.
2. Layout components.
3. Loading components.
4. Empty states.
5. Error states.
6. Dialogs.
7. Forms.
8. Form fields that are implemented as components.
9. Table rows implemented as components.
10. Dropdown content implemented as a component.
11. Icons created as React components.
12. Providers.
13. Context providers.
14. Skeletons.
15. Small presentational components.
16. Components used only once.

A React component file may export exactly one React component.

Do not declare a second React component inside the same file, including private or unexported components.

The only permitted additional exports from a component file are types or constants directly required by that component. Prefer moving shared types and constants into separate files.

### React component filenames

Every React component filename must use PascalCase.

Correct examples:

```text
ProjectCard.tsx
SceneEditor.tsx
GenerateImagesButton.tsx
EmptyStoryboardState.tsx
ApplicationSidebar.tsx
```

Forbidden examples:

```text
project-card.tsx
sceneEditor.tsx
generate_images_button.tsx
index.tsx
components.tsx
```

Next.js framework files such as `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`, and `route.ts` may retain their required framework names.

Framework files must remain thin. Move substantial user interface code into correctly named component files.

### Business logic

Keep business logic outside React components whenever reasonably possible.

React components may:

1. Render user interface.
2. Hold local interaction state.
3. Connect event handlers to application functions.
4. Use focused hooks.
5. Display loading, success, and error states.

React components must not directly contain:

1. Complex prompt construction.
2. Cost calculations.
3. Permission decisions.
4. Database queries.
5. OpenAI provider calls.
6. Storage provider calls.
7. Workflow orchestration.
8. Timeline calculations.
9. Media processing logic.
10. Large data transformations.
11. Validation schemas.
12. Reusable formatting logic.
13. Authorization rules.

Place logic in:

```text
services
repositories
queries
commands
domain
lib
hooks
schemas
policies
workflows
```

Use server only modules for secrets, database operations, provider calls, and authorization.

## TypeScript rules

1. Enable strict TypeScript.
2. Do not use `any`.
3. Do not use unsafe type assertions merely to silence errors.
4. Prefer `unknown` followed by validation.
5. Validate external input with Zod.
6. Validate environment variables at application startup.
7. Derive TypeScript types from Zod schemas when appropriate.
8. Use discriminated unions for workflow states and provider results.
9. Use exhaustive checks for state transitions.
10. Use branded identifiers or clearly named identifier types where they prevent accidental misuse.
11. Keep shared contracts in the contracts package.
12. Do not duplicate domain types across applications.

## Application architecture

Use a TypeScript modular monolith.

Primary technologies:

```text
Next.js App Router
React
TypeScript
Tailwind CSS
shadcn/ui
Clerk
Neon PostgreSQL
Drizzle ORM
Trigger.dev
OpenAI API
Cloudflare R2
Remotion
FFmpeg
FFprobe
Zod
Sentry
PostHog
Vitest
Playwright
pnpm workspaces
Turborepo
```

Repository structure:

```text
apps/
  web/
  renderer/

packages/
  database/
  contracts/
  domain/
  prompts/
  media/
  storage/
  openai/
  auth/
  observability/
  config/
  test-utils/

trigger/
  tasks/
  queues/
  utilities/

drizzle/
docs/
```

Do not create a separate Python service or FastAPI service unless a future approved requirement demonstrates a measurable need.

## Layer responsibilities

### Web application

The web application handles:

1. Authentication.
2. Workspace selection.
3. Project management.
4. Script editing.
5. Scene review.
6. Character management.
7. Storyboard review.
8. Audio review.
9. Render configuration.
10. Usage visibility.
11. Export access.
12. Server actions and route handlers.
13. Triggering durable background workflows.

The web application must not perform long running generation or rendering inside a request.

### Trigger.dev tasks

Trigger.dev handles:

1. Script analysis.
2. Scene generation.
3. Prompt generation.
4. Image generation.
5. Audio generation.
6. Audio inspection.
7. Subtitle generation.
8. Asset validation.
9. Bulk generation orchestration.
10. Rendering orchestration.
11. Retry handling.
12. Progress updates.
13. Cost recording.

Use explicit queues and concurrency controls.

Suggested queues:

```text
ai-text
image-generation
audio-generation
media-processing
video-rendering
```

### Renderer

The renderer handles:

1. Remotion compositions.
2. Timeline validation.
3. Image animation.
4. Captions.
5. Transitions.
6. Audio synchronization.
7. Video rendering.
8. Thumbnail rendering.
9. Multiple aspect ratios.

### PostgreSQL

PostgreSQL is the authoritative source of application state.

Do not use background workflow state as the only source of truth.

### Object storage

Store binary assets in Cloudflare R2.

Do not store generated images, audio, subtitles, or videos as database binary values.

## Authentication and authorization

Use Clerk for authentication.

Store application users, workspaces, workspace memberships, invitations, and roles in PostgreSQL.

Roles:

```text
owner
editor
viewer
```

Every workspace owned entity must include `workspaceId`.

Every server query for a workspace owned entity must scope by both the entity identifier and the authorized workspace identifier.

Forbidden:

```ts
getProject(projectId);
```

Required:

```ts
getProject({
  projectId,
  workspaceId,
});
```

Never trust workspace identifiers, roles, ownership, project identifiers, or user identifiers supplied by the browser.

Resolve the authenticated Clerk user on the server. Resolve workspace membership from PostgreSQL. Enforce permissions through centralized authorization policies.

Authentication is not authorization.

## Database rules

1. Use UUID identifiers.
2. Include `createdAt` and `updatedAt` where appropriate.
3. Add foreign keys.
4. Add indexes for common ownership and status queries.
5. Use database constraints for critical invariants.
6. Use transactions for multi record state changes.
7. Use enums or constrained text fields for finite domain states.
8. Never edit an applied migration.
9. Generate a new migration for every schema change.
10. Keep database queries in repository or query modules.
11. Do not call Drizzle directly from React components.
12. Avoid unbounded queries.
13. Use pagination for collections.
14. Use optimistic locking or version checks where concurrent edits can overwrite data.

## Workflow rules

Every background operation must be idempotent.

An idempotency key should include relevant values such as:

```text
workspaceId
projectId
sceneId
operation
promptVersion
generationVersion
model
quality
aspectRatio
```

Before invoking a billable provider, check for an existing completed operation with the same idempotency key.

Every provider operation must record:

```text
provider
model
status
request identifier
idempotency key
attempt count
input units
output units
estimated cost
actual cost
error code
safe error message
startedAt
completedAt
```

Never implement unlimited automatic retries for billable operations.

## Cost controls

Every billable operation must:

1. Calculate an estimated cost.
2. Check workspace and project budget rules.
3. Create a pending usage reservation.
4. Execute the provider request.
5. Record actual usage.
6. Reconcile the reservation.
7. Release unused reserved value.
8. Mark failures accurately.

Required limits:

```text
maximum images per batch
maximum variants per scene
maximum retry attempts
daily workspace spending limit
monthly workspace spending limit
project spending limit
maximum render duration
maximum script length
```

Never silently spend money.

## Prompt architecture

Do not construct major prompts directly inside React components, route handlers, or Trigger.dev tasks.

Keep versioned prompt templates in the prompts package.

Prompt layers should include:

```text
global visual style
character identity
character references
scene setting
scene action
camera composition
continuity requirements
negative constraints
output requirements
```

Every generation record must store the final rendered prompt and prompt template version.

Prompt changes must not alter the reproducibility of previous generations.

## Provider abstraction

Use narrow provider interfaces for:

```text
text generation
image generation
speech generation
object storage
video rendering
```

The initial implementation may support only OpenAI, Cloudflare R2, and Remotion.

Do not build a complex universal provider framework. Use interfaces that make testing and replacement possible.

## Error handling

1. Use typed domain errors.
2. Do not expose provider secrets or raw internal errors to users.
3. Store safe operational error summaries.
4. Send detailed exceptions to Sentry.
5. Distinguish retriable errors from permanent errors.
6. Distinguish validation failures from authorization failures.
7. Preserve provider request identifiers for support.
8. Show users actionable error messages.
9. Never swallow exceptions silently.

## Security rules

1. Keep secrets server side.
2. Validate all external input.
3. Verify webhook signatures.
4. Use signed upload and download URLs.
5. Use private storage buckets.
6. Sanitize object keys and filenames.
7. Never concatenate untrusted input into shell commands.
8. Invoke FFmpeg using argument arrays.
9. Apply upload size and media type limits.
10. Apply generation and rendering rate limits.
11. Record destructive operations in audit logs.
12. Do not place secrets into client exposed variables.
13. Do not log generated signed URLs, tokens, raw session values, or secrets.
14. Apply secure headers.
15. Protect against cross workspace access.

## User interface rules

1. Build accessible interfaces.
2. Use semantic HTML.
3. Support keyboard navigation.
4. Add visible focus states.
5. Label form fields.
6. Add loading states.
7. Add empty states.
8. Add error states.
9. Prevent duplicate submissions.
10. Preserve user work during recoverable failures.
11. Make generation costs visible before confirmation.
12. Make workflow progress visible.
13. Do not hide failed scenes inside a generic success state.
14. Use responsive layouts.
15. Optimize primarily for desktop production workflows.

## Testing rules

Use Vitest for unit and integration tests.

Use Playwright for critical browser workflows.

At minimum, test:

```text
workspace authorization
role permissions
project isolation
script validation
scene state transitions
prompt construction
idempotency key generation
cost reservation and reconciliation
generation retry limits
storage key generation
signed URL authorization
timeline duration calculations
render input validation
environment validation
```

Critical user journeys:

```text
sign in
create workspace
create project
submit script
review generated scenes
create character
generate a scene image
approve an image
generate audio
configure render
start render
download export
```

Do not rely only on snapshot tests.

## README requirement

The `README.md` file must be updated after every major action or update.

A major action includes:

1. Creating or changing architecture.
2. Adding a feature.
3. Adding a dependency.
4. Adding or changing an environment variable.
5. Adding or changing database schema.
6. Creating a migration.
7. Adding a background task.
8. Adding a route.
9. Adding a provider integration.
10. Changing setup instructions.
11. Changing deployment instructions.
12. Adding a major test suite.
13. Changing repository commands.
14. Changing security or authorization behavior.

Every README update should keep these sections accurate:

```text
Project overview
Current capabilities
Architecture
Technology stack
Repository structure
Local setup
Environment variables
Database setup
Trigger.dev setup
Storage setup
OpenAI setup
Rendering setup
Development commands
Testing commands
Deployment
Security model
Cost controls
Current limitations
Implementation status
Recent major changes
```

Add a dated entry under `Recent major changes` after each major action.

Do not postpone README updates to the end of the project.

## Dependency rules

1. Use npm.
2. Use exact dependency versions in the lockfile.
3. Prefer actively maintained packages.
4. Avoid packages that duplicate platform functionality.
5. Do not add a dependency when a small well tested local utility is sufficient.
6. Explain every significant new dependency in the completion report.
7. Run the package audit command after dependency changes.
8. Do not automatically apply destructive major version upgrades.
9. Keep server only dependencies out of client bundles.
10. Do not install both competing libraries for the same role without justification.

## Git rules

1. Make focused changes.
2. Do not mix unrelated refactoring with feature work.
3. Do not rewrite user changes.
4. Do not delete files without checking references.
5. Do not commit generated secrets.
6. Keep `.env.example` synchronized with environment validation and README documentation.
7. Review `git diff` before reporting completion.

## Definition of done

A task is complete only when:

1. The requested behavior exists.
2. The architecture follows this file.
3. Authorization is enforced.
4. Input is validated.
5. Errors are handled.
6. Relevant tests exist.
7. Tests pass.
8. Type checking passes.
9. Linting passes.
10. The production build passes when applicable.
11. Database migrations exist when required.
12. `.env.example` is current.
13. `README.md` is current.
14. No known critical security issue remains.
15. The completion report is accurate.
