# Memory — Phase 5 Scene Image Generation

Last updated: 2026-07-17 (Africa/Kampala)

## What was built

- Implemented cost-controlled single-scene image generation across the scene UI, workspace-scoped server actions and API routes, OpenAI image provider, private Cloudflare R2 storage, PostgreSQL persistence, and Trigger.dev execution/reconciliation.
- Added immutable prompt/style versions, scene image generations, exact selected-reference snapshots, provider attempts, generalized usage reservations/events, and database-enforced tenant/approval invariants in `db/schema.ts` and three new Phase 5 migrations.
- Added the concurrency-limited `scene-image-generation` Trigger.dev task and the five-minute `reconcile-expired-scene-images` scheduled task.
- Added generation history, cost confirmation, reference selection, progress/error states, approval/rejection, and the Images tab to the scene workflow.
- Added focused unit tests plus `db/integration/scene-image-postgres.integration.test.ts` for terminal-state races, concurrent approval uniqueness, and cross-workspace foreign-key enforcement.
- Updated `.env.example` and `README.md` with Phase 5 configuration, migration, Trigger.dev, storage, OpenAI, testing, deployment, security, cost-control, limitation, and status guidance.

## Decisions made

- The configurable provider default is `gpt-image-2`; a dated snapshot can be selected later through configuration without code changes.
- OpenAI requests accept only `1536x1024`, `1024x1536`, and `1024x1024`. Final video crop/fit belongs in Remotion.
- Draft defaults to low quality, final defaults to medium, and high quality requires explicit manual selection.
- WebP is the default output; draft/final compression defaults are 80/90 and remain configurable.
- Use image generation without selected references and image editing with selected references. GPT Image 2 records automatic high fidelity; configurable high fidelity is sent only where supported.
- Every fresh confirmed Generate action creates a new version and paid generation record. A request nonce only makes the same submission safe to retry; it does not silently reuse an older image.
- Used style preset versions are immutable; edits create a new version.
- Exactly one successful image can be approved per scene version. Reapproval atomically replaces the prior approval while preserving history.
- Estimate and reserve cost before a provider call; record provider usage, reconcile afterward, and cap billable retries with configuration.

## Problems solved

- Ambiguous Trigger dispatches retain their reservation and can idempotently redispatch instead of incorrectly releasing budget.
- Provider completion/failure and ledger reconciliation use guarded atomic SQL so concurrent terminal transitions cannot create contradictory events.
- Reference downloads are pinned to snapshotted ETags and size metadata to prevent generating from changed objects.
- A scheduled reconciler prevents stale pending runs from depending on an open browser page.
- Composite tenant foreign keys prevent Phase 5 rows from crossing workspace/project boundaries.
- The interrupted cleanup had truncated `migrations/20260715222820_absurd_yellowjacket/snapshot.json`; it was restored exactly from `HEAD`, its Git hash matches, and it parses as valid JSON.

## Current state

- Phase 5 implementation is present in the working tree and nothing has been committed.
- All three Phase 5 migrations were applied successfully to the configured development Neon database.
- Completed verification: formatting check passed; lint passed; TypeScript passed; production build passed; default Vitest suite passed with 139 tests and 3 skipped; opt-in PostgreSQL invariant suite passed all 3 tests.
- No real OpenAI image request, R2 generation upload, or paid end-to-end smoke test was executed.
- `git status` includes CRLF/stat-only `M` noise on older files, but `git diff --name-only` isolates the real Phase 5 tracked changes. `git diff --check` passes.
- No secrets or environment values are stored in this memory file.

## Next session starts with

1. Review the final Phase 5 diff; do not redo the already completed build/test suites unless code changes.
2. Add the documented Phase 5 variables to both Vercel and Trigger.dev production environments.
3. Deploy Trigger.dev tasks with `npm run trigger:deploy`.
4. Run one controlled low-quality draft generation in development or a safe production workspace and verify reservation, provider usage, private R2 object, history, approval replacement, and failure reconciliation end to end.

## Open questions

- Whether to select a dated GPT Image 2 snapshot for production after the initial smoke test.
- Batch scene-image generation and a workspace style-preset editor remain deferred.
- Remotion crop/fit to final video dimensions remains part of the rendering phase.

## Session addendum - 2026-10-31

The Phase 5 notes above are a historical handoff. Current repository instructions and the operating constraints below take precedence over its deployment suggestions.

### Deferred VCStudio MCP integration

- The user wants to retain the idea of a custom VCStudio MCP integration for Claude and ChatGPT on desktop and web, subject to each client's supported connections and permissions. This is a future feature, explicitly deferred; do not implement it until separately requested.
- The intended scope is broad application access through deliberate tools for projects, scripts, scenes, characters, assets, generation, review, rendering, publishing, schedules, and usage. Reuse existing application services and authorization policies rather than granting direct database access.
- Resolve the connected user and workspace membership on the server. Preserve owner/editor/viewer permissions, scoped access, confirmations for costly or destructive actions, budget reservations, idempotency, rate limits, and audit records. Long-running work should return a durable job identifier and expose status.
- MCP access must respect deployment and workspace feature flags. Marketing Studio remains paused under `AGENTS.md`; this idea does not authorize enabling marketing, reactivating schedules, starting workers, or spending provider credits.

### Social and Workspace navigation review

- The initial review was read-only. The user subsequently authorized implementing the shared Accounts & connections page.
- Confirmed overlap: Social Accounts (`/app/social/accounts`) and Workspace settings' Connected channels section both present the workspace's platform connections. Social adds posting requirements; settings provides connection management. A possible future consolidation is one Accounts & connections page with owner-only management and editor read access, linked from settings.
- Implemented consolidation at `/app/social/accounts`: owners manage connections, editors view account status and posting requirements, and Workspace settings links to this page instead of loading a duplicate list. The editor link to owner-only settings is removed. OAuth returns and disconnect revalidation target the shared page; Facebook's page-selection endpoint and cookie scope remain unchanged. Recognized legacy settings OAuth status links forward safely.
- No other direct duplicate was found between these two menu groups. Social scheduling concerns posts; the Workspace production queue concerns video projects. Posts and Schedule share post data but serve list/composition and date-based browsing respectively.
- Consolidation verification: 64 focused unit and mocked integration tests passed, including owner/editor permissions, server-scoped disconnects, all six OAuth returns, Facebook selection completion/expiry/workspace isolation, legacy status forwarding, and the marketing pause. Formatting, TypeScript, production build, and lint passed (one pre-existing prompts warning). Isolated Chrome checks passed with zero console errors or backend requests. Real provider consent was not exercised. No migrations, dependencies, environment changes, worker starts, deployments, or schedule changes were made.

### Application-wide spacing standard

- The user explicitly requested consistent production-style spacing throughout the application. This supersedes the earlier compressed shell padding, Social-only margin compensation, and 2px heading nudges. Use the shared system documented in `docs/ui-spacing.md` and the UI rules in `AGENTS.md` for future work.
- The shell, page stacks, heading groups, grids, panel/card padding, form/reading widths, public/auth/onboarding surfaces, and bounded chat workbench now follow shared responsive geometry. Preserve intentional density inside editing controls, tables, timelines, and thumbnail grids. Do not restore the removed `SocialPageFrame` offsets.
- Verification passed: full suite 2,529 tests, 162 skipped; 33 focused regressions after the shell-margin correction; TypeScript; formatting; lint with one existing prompts warning; production build; 150 mocked browser layouts across 15 screens, five widths, and both themes, with zero console errors, backend requests, or server-action calls. The initial concurrent full run had one PDF timeout; its isolated rerun and the complete rerun with two workers passed.
- Marketing remains paused. No database, migration, environment, dependency, deployment, worker-start, provider-spending, or schedule changes were made. The deferred MCP idea above remains deferred.
