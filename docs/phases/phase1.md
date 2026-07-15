# Phase 1 prompt: Authentication, user synchronization, and workspace onboarding

Read `AGENTS.md` and `README.md`.

Implement production grade authentication and workspace onboarding.

## Required behavior

1. Users can sign up and sign in through Clerk.
2. The application synchronizes authenticated Clerk users into PostgreSQL.
3. First time users create a workspace through an onboarding screen.
4. The creator becomes the workspace owner.
5. Authenticated users without a workspace are redirected to onboarding.
6. Authenticated users with a workspace are redirected to the application dashboard.
7. A user can belong to multiple workspaces.
8. The active workspace is resolved securely.
9. The browser must not determine authorization.
10. All application routes require authentication.
11. All workspace queries require verified membership.

## Required interfaces

Create:

```text
Public landing page
Sign in route
Sign up route
Workspace onboarding page
Authenticated application shell
Workspace selector
User account menu
Access denied state
```

Follow the one component per file rule strictly.

## Clerk synchronization

Implement both:

```text
lazy synchronization when an authenticated user accesses the application
Clerk webhook synchronization for user creation and updates
```

Webhook processing must:

```text
verify the Clerk signature
be idempotent
handle duplicate delivery
avoid trusting unverified payloads
record safe failures
```

## Authorization

Implement centralized authorization policies for:

```text
owner
editor
viewer
```

Add tests proving:

```text
unauthenticated users cannot access the application
nonmembers cannot access workspaces
viewers cannot mutate workspace data
editors cannot manage workspace membership
owners can manage workspace settings
workspace A members cannot access workspace B
```

## Database

Add any required schema fields, indexes, constraints, and migrations.

Never edit an existing applied migration.

## Documentation

Update:

```text
README.md
.env.example
architecture documentation where needed
```

Add a dated entry under `Recent major changes`.

## Verification

Run:

```text
formatting
linting
type checking
unit tests
integration tests
production build
```

Report actual results.

Do not implement invitations or billing yet.
