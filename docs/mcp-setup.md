# VCStudio MCP v1 setup and verification

Connection, import/reuse and publication milestones are implemented locally.
Keep the endpoint disabled until the release gates below are complete. No live
acceptance on ChatGPT or Claude is claimed by the local tests.

## Delivered milestones

1. Connection foundation: stateless official SDK endpoint, Clerk verification,
   workspace grants, effective capabilities, settings, activity and revocation.
2. Import and reuse: optional native file references, public HTTPS imports,
   signed-in upload, library tools, script/scene edits and independent scene-image
   copies. Whole-image contain fitting is the default; review remains explicit.
3. Publishing: Social drafts, destination validation, exact preview, MCP Apps or
   browser approval, scheduling, cancellation and per-destination status.
4. Release verification: local protocol, PostgreSQL, provider/worker mocks and
   responsive browser checks exist. Real client acceptance and deployment remain
   pending; local browser fixtures do not prove OAuth or native client support.

## Runtime and authentication

- The public resource URL is `{APP_BASE_URL}/mcp`; `APP_BASE_URL` must be HTTPS in
  production. Resource metadata is at `/.well-known/oauth-protected-resource/mcp`.
- Reuse the existing Clerk application as OAuth authorization server. Enable OAuth
  consent, CIMD onboarding and S256 PKCE. Do not enable anonymous tool access.
- Create the custom scopes `vcstudio:read`, `vcstudio:edit`, `vcstudio:media`,
  `vcstudio:review`, `vcstudio:publish`. Enable requested identity/refresh scopes
  in Clerk and copy actual callback URLs from the client setup rather than guessing.
- Access tokens must be JWT-formatted and resource-bound: their verified `aud`
  must include the exact canonical MCP resource URL. Clerk verifies signature,
  issuer and expiry first. VCStudio rejects opaque or incorrectly bound tokens.
  Confirm that the current Clerk instance can issue this binding before enabling
  the endpoint; do not remove audience validation to work around incompatibility.
- Set `ENABLE_MCP=false` by default in web and worker configurations. No new
  provider keys are needed. Remote imports reuse private R2 storage and the existing
  `PLATFORM_TOKEN_ENCRYPTION_KEY` for temporary encrypted download references.
- After linking, call `get_connection`, open `/app/settings/mcp`, and grant selected
  workspaces and capabilities. OAuth scopes and application grants are intersected
  with current PostgreSQL membership and centralized role permissions on every call.

## Database and workers

Generate new migrations with the project's Drizzle workflow; never edit applied
migrations. The existing history has non-commutative `planned_release_at` additions
and an index hint requirement. MCP generation used the CLI's `--ignore-conflicts`
and a create-index hint; the new, unapplied migration was narrowed to MCP statements
only. Historical SQL files were left intact. Check the real migration baseline
before applying the MCP migrations to a shared database, in order:

- `20261103225447_mcp_import_reuse_publish`: connections, grants, operations,
  provenance and the Social dispatch lock.
- `20261103225718_mcp_audit_events`: MCP audit event types.
- `20261103233638_mcp_project_provenance_cleanup`: remove assignment provenance
  with a deleted scene copy while preserving its shared library original.

On 2026-11-04 the three migrations were applied to an isolated branch cloned from
production and verified, then applied to the production `neondb` database after
explicit user approval. Verification found all four MCP tables, the nullable Social
lock column, three audit values, three matching migration-ledger entries and the
provenance cascade. The temporary branch was removed by the migration workflow.
Only the MCP migrations and their new ledger records were applied; older history
was not replayed or rewritten. The repository's legacy migration-baseline gaps
still need separate reconciliation before using the unrestricted migrate command.

The on-demand `mcp-media-import` task uses a concurrency-two queue and one bounded
attempt. Its payload contains operation and workspace IDs, never download URLs.
Existing `media-inspection` verifies uploaded videos. The shared 30-minute recovery
and six-hour storage sweep handle MCP recovery/cleanup when the feature is enabled;
no new scheduled task is added. Cleanup follows existing storage dry-run settings.
Configure R2's incomplete-multipart-upload lifecycle rule so an interrupted worker
whose abort request also fails cannot retain unfinished upload parts indefinitely.

Deploy workers only for the finished feature's runtime, not for UI verification.
Keep all Marketing switches and schedules paused. LinkedIn Pages remains on hold.

## Content behavior

Native file references, public HTTPS downloads and signed-in upload handoffs all
produce workspace-owned library assets. Imports do not invoke generation providers.
Video readiness requires inspection. Uploaded stills assigned to a scene become
independent project-owned copies awaiting review. Contain fitting preserves the
whole image; cover fitting explicitly crops. Project deletion leaves the library
original intact. Content is never automatically published after import.
Browser uploads are copied to server-owned keys before inspection; the original
signed PUT cannot overwrite a verified asset. Imports with generic download MIME
types can use native MIME hints or supported filename extensions, but actual image
decoding or background video inspection still decides whether the asset is usable.

Publishing preparation freezes the content, media and account preview for ten
minutes. UI-only approval uses a one-use proof outside model-visible content, or a
signed-in browser action. A post lock prevents concurrent edits during dispatch.
Disconnecting an AI client cancels pending requests and approvals, while committed
approvals and existing Social schedules remain valid. Each destination retains
its own persisted outcome. TikTok is inbox-only; MCP does not provide Direct Post.
Use `prepare_publication` with `action: "cancel_schedule"` for an existing schedule
and its current version/destinations. Cancellation receives the same human review
as publication. Browser and MCP brief edits and Social dispatch share revision
checks; drafts, targets and approval locks cannot be overwritten by a competing
publication request.

## Development and release checks

- `npm run mcp:build` builds the standalone React/shadcn MCP Apps review resource.
  `npm run dev` and `npm run build` run it automatically. Generated HTML is ignored.
- `npm run test:e2e:mcp` runs the isolated Chromium fixture journeys without Clerk,
  Neon, R2, Trigger.dev or external publication. The host fixture uses the actual
  MCP Apps bridge, and browser/server-action responses are mocked.
- Run formatting, lint, TypeScript, mocked unit/integration tests, critical
  Playwright journeys, `npm run env:check`, the production build and `npm audit`.
- Test Claude web, Claude desktop, ChatGPT web and ChatGPT desktop individually.
  Record OAuth/remote MCP support, native files, generated-image transfer, external
  file outputs, review UI and fallback behavior separately. A supported upload
  fallback cannot compensate for a client that lacks remote MCP itself.
- Use mocked provider/worker tests first. Real account linking and publication
  require the user's account and explicit approval for the exact external action.
- Do not enable Marketing, generate paid media or post publicly to test the UI.

## Verification record and release gates

Local checks include formatting, lint, TypeScript, environment placement, Vitest,
the real MCP SDK transport and MCP Apps bridge, real isolated PostgreSQL SQL,
image decoding/fitting and mocked storage/provider/worker flows. The production
build has passed. The final Vitest run passed 2,768 tests across 378 files, with
162 tests skipped across 35 files; MCP accounts for 99 passing tests across 13
files. All six isolated Chromium journeys passed. Lint reports four existing
warnings outside MCP code; TypeScript and environment placement passed.
Changed files pass Prettier checks. The repository-wide `npm run format:check`
still reports formatting differences in existing files outside this change; a
repository-wide reformat is intentionally not mixed into MCP implementation.

The final dependency audit reports 111 advisories: 1 low, 78 moderate, 31 high and
1 critical. The remaining critical is development-only `tar@6.2.1` beneath
`trigger.dev -> c12 -> giget`; it predates MCP. Targeted compatible fixes updated
Next.js/ESLint to 16.4.5, Sharp to 0.35.5, proxy-addr and tar 7. No forced major
upgrade was applied to the legacy Trigger CLI dependency. This is not a clean
audit; the existing CLI dependency remains a separate security follow-up.

| Client          | Remote OAuth/MCP | Native chat files | Interactive approval | Browser/upload fallback |
| --------------- | ---------------- | ----------------- | -------------------- | ----------------------- |
| ChatGPT web     | Not run          | Not run           | Not run              | Local fixtures only     |
| ChatGPT desktop | Not run          | Not run           | Not run              | Local fixtures only     |
| Claude web      | Not run          | Not run           | Not run              | Local fixtures only     |
| Claude desktop  | Not run          | Not run           | Not run              | Local fixtures only     |

The production database, Clerk resource/scopes and deployment prerequisites are
complete. The user explicitly approved the controlled rollout on 2026-11-04.
Production web and Trigger.dev now use `ENABLE_MCP=true`; Vercel Preview, local
`.env` and `.env.example` remain false. The ignored `.env.vercel` and `.env.trigger`
files mirror their production flags. Marketing remains paused and the seven
existing schedule activation states and intervals are unchanged.

Actual consent-based token issuance, exact audience and all client workflows are
still acceptance gates. Never weaken audience validation to force a connection.
Live public posting requires approval of the exact content/accounts. Client tests
must distinguish remote MCP support from chat-file access and review UI support.

## Clerk configuration verified during release preparation

The linked application is VCStudio's existing development instance; no Clerk
production instance is configured. The current CLI (4.1.0) passes health checks;
the previously installed 2.2.0 reports malformed API requests, so use the current
CLI for setup. Runtime files use the same development publishable key/issuer.

The initial OAuth settings had JWT access tokens on, but audience claims,
PKCE enforcement and CIMD advertisement off, with no custom scopes/default scopes
configured and no OAuth resources registered. The official API schema explicitly
supports `aud_claim_enabled` deriving `aud` from RFC 8707 `resource`; this removes
the earlier uncertainty about API support, but actual token issuance still needs
a consent-based verification.

Create and advertise the five `vcstudio:*` scopes listed above in Clerk's Scopes
page, then register `https://vcstudio.veilcode.studio/mcp` as an MCP OAuth resource
with those scopes. Prepare the OAuth settings with JWT tokens, audience claims,
S256 PKCE and CIMD advertised; keep dynamic registration disabled. Set the scope
ceiling and defaults to `openid`, `profile`, `email` and the five application
scopes after the scope catalog exists. Do not default `offline_access`: Clerk's
published settings schema rejects it in defaults. Application workspace grants
remain a separate mandatory intersection, not an OAuth-wide workspace grant.

On 2026-11-04 the user manually created all five custom scopes; the dashboard
confirmed their exact keys and that each is advertised. After explicit user
approval, the CLI registered the production MCP resource and applied the settings
above. Readback confirmed resource ID `oares_3Ld8Ql9jn14FOzRkqUHcy0wsD3L`, the exact
URI, all five scopes and the MCP marker. Settings readback confirmed JWT tokens,
audience binding, PKCE and CIMD on; dynamic registration and refresh-token audience
backfill remain off.

The Clerk authorization-server metadata returned HTTP 200, advertised CIMD and
S256, included all five custom scopes, and omitted a dynamic-registration endpoint.
Actual consent, token issuance/audience and each client workflow still need live
testing. The deployed web discovery now returns HTTP 200 for the canonical resource.

## Controlled production rollout - 2026-11-04

- Implementation commit: `1b463a3c903022954a3314458aab27c7e2b94c46`, pushed to `master`.
- Web: Vercel `dpl_8sXeKxDq6kAQCiJ77zEtuJg1sGYU`, production READY, about 130 seconds;
  `https://vcstudio.veilcode.studio` serves that exact source commit.
- Worker: Trigger.dev `20261104.1`, deployment
  `deployment_q449zgkwfty5myfoki4kj`, promoted successfully. Its 31 registered tasks
  include `mcp-media-import`; SDK and CLI are both 4.5.4.
- Flags: production MCP true; Preview/local/example false. Production worker
  Marketing false; the existing Vercel Marketing setting was preserved. All three
  Marketing schedules remain inactive. Shared recovery stays every 30 minutes,
  storage reconciliation every six hours; no schedules were added.
- Live read-only checks: protected-resource and authorization-server metadata 200,
  exact canonical resource and all five scopes, CIMD/S256, unauthenticated POST 401
  with the resource-metadata challenge, untrusted Origin 403, ChatGPT preflight 204,
  GET 405, signed-out settings 307, and site framing protection retained.
- The deployment-scoped error/fatal runtime-log scan returned no groups. This is
  a short smoke check, not evidence of authenticated end-to-end client acceptance.
- No manual worker tasks, paid generation or public posts were triggered.
- Trigger.dev SDK 4.5.4's `envvars.update` helper throws `name is not defined`
  outside a task. The flag was updated through the same documented PUT API and
  verified with the SDK's retrieve method; installed dependencies were not edited.

### First client test: ChatGPT web

The user selected ChatGPT web first. Follow OpenAI's current
[connection instructions](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt):

1. Open [ChatGPT Plugins](https://chatgpt.com/plugins), select **+**, then
   **Add custom MCP server**. Account/workspace policies can restrict this option.
2. Name it **VCStudio**, use `https://vcstudio.veilcode.studio/mcp`, choose OAuth,
   and complete the sign-in/consent flow. Do not use shared workspace credentials.
3. Start a conversation with VCStudio selected and ask **Check my VCStudio connection**.
4. Open [AI connections](https://vcstudio.veilcode.studio/app/settings/mcp), select
   the connection/workspace and grant only the needed permissions. OAuth alone
   does not grant workspace access.
5. Ask it to list granted workspaces/projects. Then test importing a known image,
   assigning it to a scene pending review, and saving text into a draft. Use the
   secure upload handoff when ChatGPT cannot expose the original file.
6. Test exact publication/schedule approval only with a chosen eligible account
   and explicit human approval. Record per-destination results. Do not treat a
   connected server as proof that native chat-file transfer works.

Real OAuth consent, workspace grants and client journeys have not yet been
verified; the compatibility matrix above remains intentionally unaccepted.
