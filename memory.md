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

### Select controls and asset loading — 2026-10-31

- All 49 native selects now use the existing shadcn Select through `FormSelect`. Keep adjacent standard inputs and select triggers at 40px. Explicit item values, labels before popup mount, grouped/empty choices, numeric conversion, required/disabled fields, named form values, and uncontrolled form reset behavior are preserved. Inline filters retain appropriate widths.
- The post composer's All posts button aligns with the heading's left edge. Keep its `self-start justify-start` alignment.
- The media library uses 24-item cursor pages, signs only visible assets, retains filter/back navigation, and remounts local state when workspace/kind/cursor changes. Post and brand pickers fetch count-free pages only on open or explicit Load more. Failed next-page reads retain loaded assets and selection; stale closed-dialog responses are ignored.
- Shared images use lazy loading and async decoding; clickable video/audio tiles do not attach media sources. Detail/inline players preload no bytes. The small navbar logo remains eager. Private signed URLs remain expiring; original image files are still served, with responsive thumbnail variants deferred.
- Post lists batch attachment summaries and omit unused preview signing, rich-text documents, and render snapshots. The request-scoped workspace context reuses its verified membership list; explicit authorization lookups remain fresh. See `docs/ui-loading.md` and `docs/ui-spacing.md` for maintenance rules.
- Verification: 2,574 tests passed, 162 skipped; formatting, TypeScript, lint (one existing prompts warning), and the final production build passed. There were 31 focused browser assertions and 150 responsive layout cases using mocked data, with zero console errors. An initial concurrent PDF test timeout passed in isolation and the final full rerun. The production build needed network access for the configured Google fonts. Live database/provider workflows were not exercised.
- Marketing remains paused. No dependencies, schema, migrations, environment variables, deployments, workers, schedules, or billable provider operations changed. The MCP idea remains deferred.

### Responsive navigation — 2026-10-31

- The public navbar stays on a single 56px row and uses the existing shadcn Sheet below 1024px. Desktop/mobile links share `LANDING_NAV_LINKS`; `LandingAccountActions` shares the existing Clerk controls. Section/account navigation and resizing to desktop close the mobile sheet. Short screens scroll, with keyboard focus trapping and return preserved.
- The application navbar bounds long account names, hides the account name below 1024px, preserves the workspace label, and gives sidebar/account controls 44px targets. Shared navbar/content gutters stay aligned.
- Disable sidebar tooltips when expanded or mobile. A visually hidden tooltip was consuming the first Escape press before the mobile sidebar could close; disabling it at the root fixes this while retaining collapsed desktop tooltips.
- Verification passed: 22 relevant tests; 54 mocked browser layouts across nine widths (320–1920px), both themes, long names, and signed-in/out states; keyboard/menu/resize/landscape/sticky checks; formatting, TypeScript, lint with one existing prompts warning, and the production build. Browser checks made no backend requests; live Clerk authentication was mocked. No migrations, environment variables, dependencies, workers, or schedules changed. Marketing remains paused and MCP remains deferred.

### Scene image control containment — 2026-10-31

- Scenes → Images uses container queries for the configuration, size, quality, and reference grids. Wide viewports can still contain narrow editor columns; do not restore viewport-based columns here. Fieldsets/grid children use `min-w-0`, choice inputs keep their width, and descriptions wrap without clipping controls.
- Shared shadcn select values truncate within the trigger, arrows do not shrink, and popup width follows the trigger while remaining capped by available viewport space. Long option labels wrap. The paid image confirmation summary also wraps long style names without changing its estimate or confirmation behavior.
- Verified 60 mocked layouts across 320–1600px viewports and 240–960px parent widths in both themes, plus 25 interaction assertions for selections, the last-size guard, reference limits, disabled controls, bulk/upload popups, and cost-review wrapping. No browser errors, backend requests, or provider actions occurred. All 88 relevant tests, formatting, TypeScript, lint (one existing prompts warning), and the production build passed. No database, migration, dependency, environment, worker, or schedule changes. Marketing stays paused; MCP stays deferred.

### Project card containment — 2026-10-31

- The Projects grid has an explicit `grid-cols-1` base and uses available container width for two columns at 640px and three at 1024px. Cards use `min-w-0`; long descriptions wrap, full truncated titles remain available through their title attribute, status and budget/date rows wrap, and pagination wraps. Do not rely on an implicit auto-sized card track or hide oversized cards behind the shell's clipping.
- Verified 40 mocked layouts at 320–2560px, both themes and expanded/collapsed sidebars, plus 50 UI assertions covering card containment, column changes, links, keyboard focus, pagination, creation/viewer controls and the empty state. No console errors or backend requests. All 12 relevant tests, formatting, TypeScript, lint (one existing prompts warning), and the production build passed. Data loading, permissions, provider behavior and the Marketing pause are unchanged. No migrations, environment variables or dependencies changed; MCP remains deferred.

### Mobile sidebar navigation dismissal — 2026-10-31

- Use `SidebarLink` for application sidebar destinations, including workspace home, primary links, Publishing and Marketing submenu links, and the conditional workspace-settings link. Next.js's accepted-navigation handler closes only the mobile drawer, including current-page and keyboard navigation. Preserve caller cancellation and native modified/new-tab behavior; do not change the desktop expansion preference or its cookie when following links.
- Group expanders, theme controls, and the paused Marketing dialog remain interactive without closing the drawer. The Marketing deployment pause and existing access checks are unchanged.
- Reproduced the original drawer remaining open after navigation. The fix passed 12 focused unit/mocked integration tests and 57 isolated browser assertions across Light/Dark, 360/767px mobile widths, and expanded/collapsed desktop navigation at 1280px. No console errors, backend requests, or server actions occurred in the browser checks; navigation/authentication were mocked. Formatting, TypeScript, lint (one existing prompts warning), and the production build passed. No dependencies, database, migrations, environment variables, workers, schedules, or deployments changed. MCP remains deferred.

### LinkedIn disconnect and confirmation — 2026-10-31

- Reproduced the reported generic disconnect failure through the real registry with mocked persistence: the disconnect service called `createVideoPublishProvider`, which throws for LinkedIn and X before clearing tokens. Developer-app verification cannot change that code path. Use `createPlatformOAuthProvider` for connection lifecycle operations; provider construction, decryption, and optional remote revocation must not prevent workspace-scoped credential destruction. Safe warnings omit provider error text and credentials. Persistence failures still report failure.
- `DisconnectChannelDialog` is shared by Accounts & connections and project publishing. It names the account/platform, preserves history, warns about scheduled posts, focuses Cancel, and requires explicit confirmation before any action. Pending requests prevent repeat submission and dismissal. Failures remain open for retry with safe messages; successful operations close and refresh. Existing server-resolved owner permissions and workspace scoping are preserved.
- LinkedIn's current OAuth adapter has no remote-revocation method: local credentials are destroyed without claiming to revoke LinkedIn-side app consent. See `docs/publishing-connections.md`.
- Verification passed: 60 focused unit/mocked integration tests, including all six platforms through the real registry; 93 mocked browser assertions at 360/1280px in Light/Dark; formatting, TypeScript, lint (one existing prompts warning), and production build. Browser checks made no backend requests and produced no console errors. Vercel's recent retained logs contained no matching disconnect event, so the diagnosis is based on the reproduced code failure. No production account was changed. No dependencies, migrations, database, environment, deployment, worker, or schedule changes; deploy the web update before retrying in production. Marketing stays paused and MCP remains deferred.

### Disconnect toast and LinkedIn Pages review — 2026-10-31

- The shared disconnect dialog now shows one Sonner success toast naming the platform and account only after a successful action. Both Accounts & connections and project publishing use it. Cancelled, pending, and failed requests never show success. Reuse the global toaster rather than adding page-local instances.
- Current LinkedIn support is personal-profile-only: OAuth requests `openid`, `profile`, and `w_member_social`; account identity comes from `/v2/userinfo`; post authors and uploaded-asset owners use `urn:li:person:`. No organization discovery, page selector, or organization-author path exists. Company-page support needs approved organization API permissions, page selection/role checks, organization authors/owners, and consent to added scopes. App verification alone does not implement or grant this support. The actual developer app's product approvals were not inspected. Official sources and implementation limits are recorded in `docs/publishing-connections.md`; Pages support was reviewed, not built.
- Verified 25 focused tests, 125 mocked browser assertions at 360/1280px in both themes (including real toast rendering, account/platform text, success-only counts, retries, and viewport containment), formatting, TypeScript, lint with one existing prompts warning, and the production build. No browser errors or backend requests. No dependencies, migrations, database, environment, workers, schedules, or deployment changes; Marketing stays paused. Changes are ready for web deployment.

### LinkedIn company Page implementation — 2026-10-31

- The user supplied a separate Community Management app's credentials and authorized implementation. Accounts & connections now offers separate LinkedIn profile and Page buttons. The Page flow uses `/api/linkedin/pages/authorize`, `/api/linkedin/pages/callback`, and `/app/social/accounts/linkedin-pages`; it requests only `rw_organization_admin` and `w_organization_social`, without OpenID or userinfo. The personal app and existing connections retain their original flow.
- Page discovery is owner-only, on demand, and limited to ten ACL entries per page. Only approved administrators are offered because the organization metadata lookup requires administrator access; content-only roles are currently unsupported. Confirmation reloads the ACL slice and checks `ORGANIC_SHARE_CREATE` for the exact member and Page. Browser-provided names, roles, workspace IDs, and tokens grant no access. The shadcn selector retains selection after recoverable failures and guards pending and duplicate submissions.
- Signed OAuth state also requires a matching browser cookie. The short-lived pending selection cookie is encrypted and bound to purpose, user, workspace, and token expiry. Credentials never enter URL parameters, client props, or form fields. Page connections store canonical organization URNs in the existing external-account field; legacy personal IDs, including numeric IDs, remain personal. `createConnectionOAuthProvider` selects the matching app for refresh and disconnect. No database schema change or migration is needed.
- Social text, image, and video publishing uses the correct person or organization author/media owner and existing queues/history. LinkedIn video uploads now validate bounded multipart ranges, transfer at most 4 MiB per part, finalize ordered ETags, and wait for processing through the existing durable wait callback. Authorization failures are non-retriable. Ambiguous post-creation responses, including HTTP 5xx, require inspection and must not automatically retry. No new task or rendered-project LinkedIn publishing was added.
- `LINKEDIN_PAGES_CLIENT_ID`, `LINKEDIN_PAGES_CLIENT_SECRET`, and `LINKEDIN_API_VERSION` belong in both Vercel and Trigger.dev: web OAuth and worker token refresh each need the correct configuration. Their local `.env`, `.env.vercel`, and `.env.trigger` values match. The safe `.env.example` catalog was restored, and the pre-existing local deployment copies of `E2E_CLERK_USER_EMAIL` were removed to satisfy placement rules. Remote dashboards and deployments were not changed. Never commit the real env files.
- Verification passed: 412 unit and mocked integration tests across 51 files, 177 isolated browser assertions across Light/Dark and 320/390/768/1280px widths, formatting, TypeScript, lint (one existing prompts warning), environment placement checks, and the production build. No browser errors or backend requests occurred. Live LinkedIn consent and posting were not exercised. The build emitted the existing Node localstorage-path warning without failing.
- Before production use, obtain the Pages app's Community Management permissions, register `https://vcstudio.veilcode.studio/api/linkedin/pages/callback` on that app, configure the remote env variables, and deploy the web update and changed `social-post-publish` worker. Programmatic refresh tokens depend on LinkedIn approval; otherwise expiry requires reconnection. Marketing remains disabled in all three local env files, no workers or schedules were started, and the custom MCP idea remains deferred.

### LinkedIn production environment configuration — 2026-10-31

- The user explicitly requested supplying the variables to both production environments. Saved the Page client pair and `LINKEDIN_API_VERSION` in Vercel project `vcstudio` (`prj_T0KWfnlVtJL4AmfRFvoa7TMdTkfD`, team `team_24dtIFqfL1X7RkcGc6gVif0X`), targeting Production only for these three keys. The client pair uses Vercel Secret storage. The connector acknowledged all three writes with no failed entries; a subsequent metadata read confirmed their keys, Production scope, and storage types. No credential values were displayed.
- The Trigger.dev connector has no environment-management tool, so used the documented API with the existing authenticated CLI profile for project `proj_fyzoywswfqeczmuwiacz`, environment `prod`. Current import payloads require a key/value record, despite the API-reference search result showing an array; the installed SDK's `ImportEnvironmentVariablesParams` specifies the working record format. Imported the Page client pair with `isSecret=true`, and the API version plus Marketing flag as ordinary configuration. Import acknowledgements and a fresh read verified the secret variables' presence/type, readable configuration values, and unchanged unrelated variables. Secret values are redacted on retrieval, so equality cannot be checked after saving.
- Found Trigger.dev's production `ENABLE_MARKETING_STUDIO=true`; restored it to `false` under the standing pause instruction. Also explicitly saved Vercel's existing Marketing flag as `false`, preserving its Production/Preview targets. No deployment, worker start, task execution, schedule change, commit, or push occurred. The existing Marketing schedules were not modified. New web/worker code still needs deployment; existing Vercel deployments do not receive project env edits until redeployed. The deferred MCP idea remains deferred.

### LinkedIn invalid client ID correction — 2026-11-01

- The reported Page client ID matched the local ID after trimming. All three local env files contained a leading space inside its quoted value; dotenv preserved that space and the OAuth client sent it verbatim. The previous production synchronization carried it over. Corrected only `LINKEDIN_PAGES_CLIENT_ID` in `.env`, `.env.vercel`, `.env.trigger`, Vercel Production, and Trigger.dev `prod`, preserving secret storage and the other credential values. Trigger.dev acknowledged the write; its fresh metadata read confirmed the ID's secret presence, unchanged unrelated values, and Marketing still `false`.
- The shared publishing environment schema now trims surrounding whitespace from the personal and Pages client ID/secret settings. Keep normalization at this boundary so authorization, exchange, and refresh use identical credentials. Optional/blank app configuration continues to use the existing lazy readiness errors. Three new regression cases first reproduced the failure; all 415 relevant publishing, Social, and env unit/mocked integration tests across 52 files then passed. Real LinkedIn consent was not exercised. No new keys, dependencies, database changes, migrations, workers, or schedules were introduced.
- The live web release was verified as `1cf28a62e0a8713bb58df97284606b7ca073bbe4`, deployment `dpl_9qbXeF4KH9r4pbSPBioB6hioXjj8`, under the existing `vcstudio` project and team. Redeployed that exact existing source to apply the corrected production setting: `dpl_u61uGAUDEyAgUfJXP5CmgP6EheWY`, `vcstudio-foao2n03z-ghostsyscoders-projects.vercel.app`, READY after about 109 seconds. A fresh lookup verified that `vcstudio.veilcode.studio` now resolves to the new deployment and the same source commit. The local normalization guard is a separate uncommitted change. No source push or worker deployment occurred. Retry through Connect LinkedIn Page to obtain a fresh authorization URL; restart local development if testing there. Marketing and the deferred MCP idea remain paused.
- Final verification passed: formatting, full lint (one existing prompts warning), TypeScript, env placement, diff checks, 415 relevant unit/mocked integration tests across 52 files, and the local production build. Local env IDs match and contain no whitespace; all three local Marketing flags remain false. Production smoke reads returned 200 for `/privacy` and an authentication redirect for `/api/linkedin/pages/authorize`. The initial new-deployment runtime error/fatal aggregation returned no groups; this is a short initial observation, not full authenticated OAuth validation. The local build retained its existing Node localstorage-path warning without failing.
