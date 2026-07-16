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
