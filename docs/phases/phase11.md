# Phase 11 prompt: End to end verification and production readiness review

Read `AGENTS.md` and `README.md`.

Do not add major new features.

Perform a full repository audit and repair defects.

## Audit areas

Inspect:

```text
React component file compliance
one component per file compliance
business logic placement
TypeScript strictness
authorization
workspace isolation
database constraints
migration consistency
idempotency
cost controls
OpenAI usage
Trigger.dev retries
R2 object security
signed URLs
FFmpeg invocation
Remotion inputs
error handling
logging redaction
environment validation
README accuracy
test quality
accessibility
responsive behavior
build configuration
deployment configuration
```

## Mandatory searches

Search the repository for:

```text
multiple React component declarations in one file
lowercase or kebab case component filenames
any
ts-ignore
eslint-disable
raw database calls inside components
OpenAI calls inside components
unguarded route handlers
project queries without workspace scope
shell command concatenation
hardcoded secrets
hardcoded provider model names
unbounded retries
floating point currency
TODO comments affecting correctness
```

Repair confirmed violations.

## End to end tests

Implement or complete Playwright coverage for:

```text
sign up or test authentication
workspace onboarding
project creation
script submission
scene analysis using a mocked provider
scene editing
character creation
reference upload using a mocked storage flow
single image generation using a mocked provider
bulk generation partial failure
image approval
audio generation using a mocked provider
timeline validation
render initiation using a mocked renderer
export access
cross workspace denial
viewer mutation denial
```

Do not require paid provider calls in automated tests.

## Final documentation

Bring `README.md` fully up to date.

Create:

```text
docs/architecture.md
docs/security.md
docs/workflows.md
docs/deployment.md
docs/provider-costs.md
docs/testing.md
docs/operations.md
```

Document current limitations honestly.

## Final verification

Run:

```text
dependency audit
format check
lint
typecheck
unit tests
integration tests
Playwright tests
production build
renderer smoke test
migration consistency check
```

Report exact results and any remaining failures.

Do not claim production readiness when critical checks fail.
