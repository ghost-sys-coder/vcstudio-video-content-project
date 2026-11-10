# VCStudio MCP v1 setup and verification

## Image/audio extension released — 10 November 2026

Version `1.2.0` is live, with 47 model-facing tools and two app-only approvals. It adds `get_generation_options`, `prepare_generation`, `execute_generation`, `get_generation_status` and `review_scene_audio`. Standalone images/narration and approved project scenes use the existing providers, private storage, budgets and shared scene services. An owner-authorized autonomous generation grant lets the agent prepare and execute its own quote, then explicitly review content through MCP. Autonomous publishing is configured separately. There is no required browser or human review click for either operation once the relevant autonomy is granted; client-side tool permissions remain separate.

The `mcp_media_generation` migration passed isolated PostgreSQL and temporary production-clone tests. After explicit owner approval, production migration `20261110001516_mcp_media_generation` was applied and recorded as Drizzle row 88; all six constraints validated and business counts stayed unchanged. The temporary test branch was deleted and matching worker `20261110.1` deployed before the web app. Clerk advertises `vcstudio:generate` and includes it in allowed/default scopes while preserving existing OAuth security settings. Both existing ChatGPT/Claude owner-workspace connections received audited Generate/autonomous generation grants, with autonomous publishing preserved. New grants default to manual.

Reconnect VCStudio once in ChatGPT and Claude to consent to the new scope, then refresh connector discovery/start a new conversation. Confirm version `1.2.0`, `vcstudio:generate` in effective scopes, `features.generation: true` and autonomous generation mode. Old five-scope tokens correctly report generation unavailable until re-consent. The full local suite passed 3,314 tests with 163 existing opt-in skips; 31 browser journeys, formatting, lint, TypeScript, environment placement and build passed. Live connection, public/private route and OAuth discovery checks pass, with no initial deployment-scoped error logs. No new dependency, environment variable, scheduled task or paid provider test was introduced. YouTube Community publishing and video generation remain on hold. See [generation setup and limitations](mcp-generation.md) for supported voices/formats and setup details.

## Browser-free upload release — 9 November 2026

The deployed follow-up release adds an in-chat MCP upload panel and focused
start/append/status/complete/cancel tools, with bounded immutable R2 chunks and the
existing import/inspection worker. It addresses the earlier transfer gap without
requiring Claude network access to R2 or browser automation. Server version `1.1.0`
and fresh discovery instructions distinguish the new tools from older cached
connectors. Native file references and HTTPS imports remain supported.

See [the upload protocol, security model and client instructions](mcp-media-upload.md).
Opening the panel is read-only; the user selects the original inside chat, while a
programmatic client with actual file access can use the chunk tools directly.
This does not grant a remote server arbitrary access to an unshared local folder.
The original assessment below is a dated pre-implementation record. Deployment
and actual-client acceptance are recorded separately from local verification.
Worker `20261109.2` deployed before web implementation `338376b`; live connection
and capability reads confirm version `1.1.0`, the new transfer tools and unchanged
autonomous publishing. Refresh connector discovery and use `open_media_upload`.
SDK/local browser checks pass; actual file selection inside Claude/ChatGPT for this
new panel remains a separate user acceptance check. No browser automation is needed
by the implemented transfer path.

## Video transfer and autonomous publication check — 9 November 2026

A read-only production check confirmed that the owner's active ChatGPT and Claude
connections both grant Read/Edit/Media/Review/Publish in VeilCode Studio and both
save `publicationApprovalMode: autonomous`. The live ChatGPT `get_capabilities`
response independently confirms autonomous mode. No approval setting was changed.
For eligible destinations, `prepare_publication` followed by
`execute_publication` with the operation ID and the same idempotency key does not
require VCStudio's human review panel. Client-side tool permissions remain
independent. TikTok is still inbox-only, with final publication in TikTok.

The ChatGPT tool definitions exposed to the checking session were older than the
deployed server: they retained manual-only instructions and omitted
`execute_publication`. The live capabilities and deployed server support autonomy;
refresh/reconnect tool discovery before using it. Do not use browser automation as
a substitute for an available MCP publication or scheduling tool. This check did
not execute any real publication or schedule.

A tiny local synthetic MP4 was transferred successfully using
`import_chat_file` with an absolute workspace path through this session's native
file adapter. Operation/asset `156b23c0-3b47-46bb-82e8-127dcaf5c1ff` succeeded.
`get_operation`, `get_asset` and a bounded verification query confirmed a ready
H.264 video, 320 × 180, 1,000 ms and 2,266 bytes, with background inspection
`succeeded`. Its saved transfer path is `file`, and temporary download credentials
were erased. The intentional lack of audio produces one harmless inspection
warning. The asset is titled **MCP native video transfer check — synthetic
1-second clip** and remains in the library as evidence. No browser upload page,
browser automation, AI generation or new worker deployment was used. The existing
on-demand import and inspection workers processed only this small test asset.

This proves the current connected ChatGPT session's file adapter, not universal
filesystem access in ordinary ChatGPT web/desktop chats, every chat-generated
video, or large-file limits. The client must expose the original file/reference.
MCP carries that reference; authorized HTTPS transfers carry the video bytes to
private storage without putting the binary into model context. OpenAI documents
file parameters and optional file helpers in its
[file interfaces](https://developers.openai.com/plugins/reference#file-apis).

Claude can use `import_asset` for a usable authorized HTTPS video URL without a
browser, but native Claude chat-file/local-folder transfer has not been proven.
The present upload handoff uses signed-in browser routes; it is not an
OAuth-authenticated MCP upload-session tool. A plain `C:\\...` or `sandbox:/...`
path is not remotely downloadable. A complete local-folder workflow needs a
permitted local uploader/bridge plus MCP upload authorization/completion, or a
client-supplied real downloadable file reference. No Claude-specific local uploader
is implemented in this repository. Anthropic distinguishes remote connectors from
local filesystem extensions in its
[connector guidance](https://support.claude.com/en/articles/11725091-when-to-use-desktop-and-web-connectors).

All 89 focused MCP protocol/import/streaming/SSRF/publication/approval/draft tests
passed during this check. The synthetic clip was encoded locally with the
existing Remotion FFmpeg binary; its trimmed build required PNG input rather than
lavfi/rawvideo. Application code, environment values, migrations and deployment
were unchanged. Do not treat this as a live autonomous video-publication test or
as verification of Claude's local transfer.

## Optional autonomous publishing

The `mcp_autonomous_publishing` release makes the publishing review click
optional for an explicitly authorized connection/workspace. Every existing grant
defaults to **Require my approval**. In AI connections, a workspace owner selects
the connection and workspace, grants Publish, chooses **Autonomous publishing**
and saves. This setting starts no work and cannot be enabled by an MCP tool.
OAuth consent and current workspace permissions still apply.

In autonomous mode, call `prepare_publication` first. It freezes the exact post,
assets, destination accounts, metadata and schedule and returns `approvalMode:
autonomous` with status `prepared`; nothing is sent. Call `execute_publication`
with that operation ID and the preparation's **same idempotency key** within ten
minutes. Repeating execution returns the existing result. Changes to content,
assets, permissions or membership invalidate a pending preparation. PostgreSQL
atomically rechecks the owner role, grant revision/mode, Publish scope and
connection revocation before authorizing dispatch.

This covers publication, scheduling, schedule cancellation and thumbnail-only
retries. Internal script/scene/media approvals stay explicit and unchanged.
Manual connections continue to require the private human review proof; an agent
supplying `confirmed: true` or requesting another mode cannot bypass that gate.
Autonomous preparations display a read-only preview instead of an approval button.
Client applications may still apply their own independent tool confirmation rules.

Switch back to manual or disconnect to block future autonomous execution. Already
authorized schedules/outbox work remain ordinary Social work and can be cancelled
separately. Marketing, LinkedIn Pages, generation, budgets and platform restrictions
are unchanged. TikTok still needs completion in TikTok. No new scheduled task,
environment variable or dependency is introduced. Apply generated migration
`20261107223040_mcp_autonomous_publishing` before deploying matching web/worker code.

Verification on 8 November 2026 passed 197 tests across 23 files, all 22 browser
journeys, formatting, TypeScript, environment validation and the production build.
Full lint passed with the three existing unrelated warnings; changed files are
clean. Phone/desktop Light/Dark screenshots were inspected, including saved-mode
persistence and an autonomous preview without a human approval button. The
generated migration passed isolated PostgreSQL and production-clone checks on
`br-spring-poetry-ai89in33`: all six business-table counts/fingerprints are
unchanged and both existing grants remain manual.

After explicit user approval, the generated migration and its original Drizzle
hash/timestamp were applied to production, and only temporary branch
`br-spring-poetry-ai89in33` was deleted. The six production record fingerprints
remained unchanged and both existing grants were verified as manual. Web commit
`cc4d56c` is READY as `dpl_rQAc8JGCwatNpPE9u3UThXtYRr4H`, serving
`vcstudio.veilcode.studio`; matching production Trigger.dev worker `20261107.2`
deployed successfully as `ay5l2nz6` with environment synchronization skipped.
Seven live checks passed for public pages, private redirects and MCP OAuth
discovery/authentication. The existing authenticated MCP connection still works
and reports `publicationApprovalMode: manual`; the immediate error/fatal log
scan returned no groups. No connection was switched to autonomy, no live provider
action was performed and no new scheduled job was added. Refresh client tool
discovery before using the new execution tool. Exact completion context is
retained in ignored `.vercel/mcp-autonomy-migration-prepared.json`.

YouTube Social drafts now support explicit upload metadata/disclosures and a
separate library thumbnail, included in the publication preview. Thumbnail
finishing waits for video processing; `prepare_publication` with
`action: retry_thumbnail` retries the original thumbnail on an existing uploaded
video using the connection's selected approval mode. TikTok remains inbox-only, with final cover selection and
posting in TikTok. See [video publishing and release requirements](social-video-publishing.md).

Connection, import/reuse and publication milestones are deployed for controlled
owner-only production use. Production web and worker MCP are enabled; local and
Preview defaults remain disabled. User verification covers ChatGPT connection,
workspace reads, image import/Social draft, desktop project reuse, explicit
scene-image approval, saved scheduling/cancellation and the first real LinkedIn
text-and-image publication. Private access and continued MCP
availability are also user-verified. The user confirmed Claude web cancellation
and closed the live verification round on 2026-11-04, choosing to handle further
issues during ongoing use. The coverage notes below distinguish observed client
journeys from unexercised details; local tests alone do not prove universal client
compatibility. No further proactive live tests are requested.

## Connection settings presentation - 2026-11-05

The settings page now separates guided connection setup, an access/approval overview,
per-client workspace permission cards and recent activity. Availability is a filled
shadcn badge with a status dot; paused deployments have a distinct warning badge.
The endpoint has the existing accessible copy control. Known HTTPS client hosts
receive readable display labels while the full OAuth client identifier remains
visible; these labels do not establish trust or change authorization. Activity
rows expose status, explicit UTC timestamps, safe errors and links to operation
details with prefetch disabled.

Shared gutters, panel spacing, Geist typography and Light/Dark colors apply to
both narrow and wide layouts. Empty connections/activity and paused deployments
have dedicated presentation. Workspace selection, scope names/defaults, role
restrictions, save/reconnect behavior and revocation confirmation retain their
existing server actions and policies. No additional data queries, schema, feature
flags, providers, environment variables or worker changes were introduced.

Verification uses only isolated browser fixtures and mocked actions. This UI work
does not reopen the owner-closed live-client acceptance round. No production
connection/grant/schedule mutation or deployment is part of this presentation task.

Verification passed: 31 relevant unit tests, 24 isolated browser journeys (including
nine settings cases across Light/Dark and 390/768/1440px), TypeScript, formatting,
lint with four pre-existing warnings, and the production build. The nine settings
journeys were rechecked after the final typography adjustment. Screenshots were
reviewed in both themes. The correction remains local and uncommitted.

## Delivered milestones

1. Connection foundation: stateless official SDK endpoint, Clerk verification,
   workspace grants, effective capabilities, settings, activity and revocation.
2. Import and reuse: optional native file references, public HTTPS imports,
   signed-in upload, library tools, script/scene edits and independent scene-image
   copies. Whole-image contain fitting is the default; review remains explicit.
3. Publishing: Social drafts, destination validation, exact preview, MCP Apps or
   browser approval, scheduling, cancellation and per-destination status.
4. Release verification: production prerequisites, deployment and anonymous live
   checks passed. Local protocol, PostgreSQL, provider/worker mocks and responsive
   browser checks passed. Exercised ChatGPT and Claude journeys are recorded
   below. The owner closed live testing after Claude web cancellation; remaining
   coverage observations are deferred rather than release blockers.

## Live verification round closed - 2026-11-04

The user confirmed successful cancellation of the existing schedule through Claude
web and explicitly said testing is done, with any further failures to be handled
as the project moves forward. Accept the exercised workflows for controlled
owner-only use. Do not request more client tests, recreate schedules or change
fixtures merely to complete the earlier checklist unless the user reopens testing
or reports a concrete issue.

Recorded coverage includes ChatGPT connection/workspace access, file-reference
import/Social draft, desktop project/script/manual-scene reuse, scene-image review,
real LinkedIn text-and-image publication, scheduling and cancellation; Claude web
connection/reads/draft/browser-upload and successful cancellation; and Claude
Desktop reads/browser-upload/project reuse, saved framing, embedded review,
human approval and scheduling.

Deferred coverage observations are retained honestly: automatic native chat-file
access is not established for every client; Claude Desktop's upload fallback is
verified; Claude's separate explicit scene-image review was not exercised; and the
final Claude web cancellation review surface/operation ID were not reported. These
are not new test requests. Leave the existing pending scene image for normal user
review. Do not silently approve it or delete test content during this closeout.

Earlier next-step notes below are historical and are superseded by this closure.

### Claude Desktop reuse and saved framing correction - 2026-11-04

The desktop client completed the browser-upload, zero-budget project, script draft,
approved manual scene and provider-free image assignment. A bounded production read
confirmed project `d4b12a01-b596-4540-93c8-05012cf1e523`, scene
`d44488f3-a54e-4d64-a2d8-dae210c1f6ee` at approved version 1, and pending image
`d9467a41-1826-45c3-9415-678e514e09a4`. The library original
`3047f4c6-d55b-42a2-9485-d5ddf40c6f6e` is ready, PNG, 1122 x 1402.

Both actual private files were downloaded read-only and inspected at full size.
All eight portrait views remain present. The 1536 x 1024 scene copy is the accepted
landscape image canvas, not the video's final resolution. Its saved 1920 x 1080
output framing is contain, centered, scale 10000 (100%). For this portrait,
containing the padded canvas in 16:9 preserves the whole image with side bars.
No existing file or approval was changed.

`assign_scene_image` now returns `importFit` (contain or explicit cover), stored
`image` dimensions and the saved `outputFraming`. `get_scene` returns image pixel
dimensions and bounded `imageFramings` per output, each tied to its exact
`sourceImageGenerationId`. These are persisted settings, not an inferred fit.
An absent saved framing retains the application's cover default. Existing
idempotent operation results remain unchanged; use a fresh `get_scene` for current
framing rather than assigning again merely to obtain richer metadata.

The renderer's automatic pacing could still zoom/pan contain images and crop their
edges during playback. New shared preview/render snapshots now disable automatic
camera motion for visible contain images, including mixed-shot scenes. Explicit
manual scale/crop settings remain user choices. Previously frozen snapshots retain
their historical motion for reproducibility.

Ready images are decoded/validated inline; `inspectionStatus` describes asynchronous
video/audio inspection and may be null for a ready still. The tool description now
states this. Import operation/asset UUIDs and assignment operation/generation UUIDs
are intentionally correlated for retry-safe creation; they remain separate records
with explicit field names and provenance. No background inspection task is added
for already-validated still images.

The image remains pending review. Publication review in Claude remains a separate
acceptance step. No paid generation, rendering, public post or schedule was started.
This correction requires no migration, environment, dependency or worker change.

Verification passed: 295 relevant tests (286 focused MCP/render/output/pacing and
isolated PostgreSQL tests plus nine existing production-baseline tests), TypeScript,
environment placement and production build. Lint passed with
four pre-existing warnings. The actual stored portrait derivative also matches
the deterministic full-image contain conversion byte-for-byte. All 15 isolated browser journeys also passed after running sequentially with the
build (their shared temporary directory prevents concurrent execution). The live
Claude Desktop read-back was subsequently confirmed by the user, as recorded below.

Corrective commit `3ba0c41fc4b496be63d9ca2461093371cdd4cb00` is pushed and
Vercel production deployment `dpl_AMypMod7yM3G3jUkPH1i8h8mZV9D` is READY on
`vcstudio.veilcode.studio`. Post-release checks passed: landing/waitlist 200,
private scene redirect to sign-in, private image 401, MCP 401 with OAuth challenge,
and discovery 200 with the canonical resource. Site framing protection remains
DENY. The user subsequently refreshed the Claude Desktop connector and confirmed
a read-only `get_scene` returns image `d9467a41-1826-45c3-9415-678e514e09a4` at
1536 x 1024 and its exact matching saved framing: mode contain, scaleBps 10000,
outputWidth 1920, outputHeight 1080, centered with black background. Review stayed
pending and nothing was changed. Accept live saved-framing read-back as passed;
do not reassign the image or approve it as a side effect of inspection.

Next, check Claude Desktop publication review using existing relevant draft
`9206ff25-759c-4d9d-9913-64a646306288`, **VCStudio — building with boundaries**.
A bounded production read after the framing confirmation found version 9, draft,
no schedule or publication lock, no attachments or queued/publishing/published
targets, and the personal LinkedIn selection preserved. Read its current version
in Claude, keep text and attachments unchanged, and prepare a fresh scheduling
preview for only Tamale Frank at 11 November 2026, 10:00 Africa/Kampala
(07:00 UTC). Do not create another draft or execute a schedule. Request any missing
Publish grant only for the existing Claude connection and this workspace; preserve
ChatGPT grants. Inspect the embedded review if available or the signed-in browser
fallback, then report which surface worked and the operation ID. Stop before
approval. Preview preparation is not scheduling or publication. Claude web review
and explicit scene-image review remain separate pending acceptance steps.

### Claude Desktop scheduling preview and embedded review passed - 2026-11-04

The user reported successful preparation of operation
`c0b505a1-6f7f-4c16-a4d5-a896e2642dd6` for existing post
`9206ff25-759c-4d9d-9913-64a646306288`. A bounded production read confirmed:

- Operation `requires_approval`, with preview version 9 and text exactly matching
  the saved draft. No attachment or new post was introduced.
- Only personal LinkedIn Tamale Frank, connection
  `9def266d-fabd-4e4c-a7c0-0eaa1f0173d3`, was selected.
- Preview time `2026-11-11T07:00:00.000Z`, timezone Africa/Kampala: 11 November
  at 10:00 AM locally.
- Post still draft version 9, no saved scheduled instant, dispatch lock or
  queued/publishing/published target. The coding session performed only a SELECT.
- Pending approval expired/expires at `2026-11-04T19:49:47.533Z` (22:49:47 Kampala).
  It was current at the verification read; freshness must be checked again before
  any later approval.

Claude's narrative said no interactive review appeared, while the user's report
said it did. Asked specifically which surface they saw, the user selected
**An interactive approval panel inside Claude**. Treat this direct observation as
Claude Desktop embedded review-display acceptance. Do not mark the browser fallback
as tested by this report, and do not confuse panel display with human approval or
schedule execution. No copy changes were requested; retain the exact existing
business-relevant draft rather than adopting the assistant's editorial suggestions.

Next, the user inspects the exact text/account/time and approves through the human
review panel only if correct, then asks Claude to read back this post and its
calendar entry. If the preview has expired, prepare a fresh preview for the same
post/current version/destination/time with a new request key; do not recreate a
draft or approve an expired operation. Do not publish immediately or add media.
After successful schedule read-back, use Claude web to prepare and explicitly
approve cancellation of that exact schedule, preserving the draft. These executions
are tracked individually below; Desktop approval/scheduling has now passed,
while Claude web cancellation remains pending.

### Claude Desktop approval and saved scheduling passed - 2026-11-04

The user completed human approval and provided Claude Desktop's post/calendar
read-back. A bounded production SELECT, scoped to the exact workspace, post and
approval operation, independently confirmed:

- Operation `c0b505a1-6f7f-4c16-a4d5-a896e2642dd6` succeeded, with
  `scheduled=true`, `cancelled=false`, and this exact post ID in the result.
- Post `9206ff25-759c-4d9d-9913-64a646306288` is scheduled at version 10,
  `scheduled_at=2026-11-11T07:00:00.000Z`, timezone Africa/Kampala. The user
  confirmed the calendar agrees: 11 November 2026, 10:00 AM locally.
- Saved text equals the approved immutable preview. Attachments remain empty.
- Exactly one target exists: `1c8e7f3e-cf1e-4c1f-8477-51eb0fdcc350`, personal
  LinkedIn connection `9def266d-fabd-4e4c-a7c0-0eaa1f0173d3`, pending with no
  external published URL. There is no duplicate target or immediate publication.
- The transient MCP dispatch lock is clear after successful scheduling. This
  remains an ordinary approved Social schedule, not a pending MCP approval.

Accept Claude Desktop approval and saved scheduling as passed. The coding session
only read production data. Do not recreate this schedule or publish another copy.
Next switch to Claude web with the same connection/workspace, read the current
post/calendar, and use `prepare_publication` with `action=cancel_schedule`, the
current revision, exact existing destination IDs and a new request key. Show the
cancellation review and stop for deliberate human approval. The user clicks
**Approve cancellation**, not **Cancel request**, then asks for fresh post/calendar
reads confirming draft status, no scheduled instant, preserved copy/attachments
and the cancellation operation result. Report whether the review was embedded
or used the signed-in browser fallback. This web-client cancellation acceptance
and explicit Claude scene-image review remain pending.

### Claude web cancellation confirmed; testing closed by owner - 2026-11-04

The user reported that cancellation of post
`9206ff25-759c-4d9d-9913-64a646306288` succeeded after the Claude web cancellation
prompt. They explicitly closed testing and chose to handle future issues during
ongoing use. Mark Claude web cancellation as user-confirmed. The final operation
ID, post revision and review surface were not supplied, and no additional live
read or test was run for this closeout. Do not claim those details independently
verified or ask the user for more evidence after their decision to stop testing.

This closes the current live acceptance round; it does not establish universal
native file access or erase the distinction between tested and deferred client
paths. README, setup documentation and project memory record the decision. No
runtime code, migration, environment, provider, deployment or worker changes were
made, and no public post or new schedule was created during closeout. Preserve
owner-only access, paused Marketing Studio and the LinkedIn Pages hold.

Scheduling, revocation preserving approved schedules, stale/replayed approvals,
workspace isolation and failed-target retry already have mocked/service or
isolated PostgreSQL coverage. That evidence does not replace live journey results.
Use existing assets and provider-free edits where possible. Live scheduling or
publication still requires review of the exact content, destination and time;
new generation, rendering and administration are outside v1.

### Scene-image approval passed - 2026-11-04

The user chose to finish MCP verification before video-generation planning. A
bounded, exact-workspace production read confirmed the existing **MCP reuse test**
fixture initially had approved scene version 1 and a successfully imported,
zero-cost image awaiting review:

- Project: `347cddbd-db2c-473d-939a-488111fc49e0`.
- Scene: `afa983f5-da55-45a7-8596-1bed0cb0b448`.
- Image generation: `0726730b-13f6-4208-b035-b982dd1c06f2`.
- Before review: `status=succeeded`, `review_status=pending`, `reviewed_at=null`.

The user ran the exact `review_scene_image` approval prompt in their connected
ChatGPT conversation and reported an approved read-back. A second bounded,
workspace/project/scene/image-scoped production read corroborated:

- `review_status=approved`, processing succeeded and actual cost remains zero.
- Approval operation `fc793b85-0aef-47cd-a0c1-b95e958afb41` is `review_image`,
  succeeded and records the exact generation with `approved=true`.
- The recorded reviewer matches the operation actor.
- The library original remains ready and undeleted; the independent project-owned
  copy and `contain` framing are preserved. No object keys or credentials were
  selected into the result.
- The project remains draft with a zero budget and approved scene version 1.
  The client reports no generation, rendering, publication or scheduling.

Accept scene-image approval as passed. No VCStudio connector tools are exposed
to the coding session, so future live client calls still require the user's
connected client. Do not substitute direct SQL mutations or collect session tokens.

### Initial scheduling preparation

The initial prompt prepares a new text-only Social draft, **VCStudio — building with
boundaries**, for the personal LinkedIn account. Its relevant copy discusses
private rollout and explicit content decisions. Proposed time: 11 November 2026,
10:00 Africa/Kampala (`2026-11-11T07:00:00Z`). The published post must not be
edited or reused. Preparation stops before approval; the user must inspect and
approve the exact review panel. The saved schedule and calendar entry are still
pending verification, followed by separately reviewed cancellation. Do not treat
the proposed time or the assistant's text as approval. If a preview expires,
prepare a fresh one for the same draft rather than creating duplicate drafts.

The user reported draft creation. A bounded production read found one matching
post, `9206ff25-759c-4d9d-9913-64a646306288`, version 2, still `draft`, with no
scheduled instant, attachments or destination records. Preview operation
`7d4f1baa-c686-46d2-9d68-6547c5265e56` is `requires_approval` and records the
intended UTC instant and Africa/Kampala timezone. Draft creation and schedule
preparation are verified; scheduling execution and cancellation remain pending.
The user was given the authenticated browser review URL to complete the required
human approval, or request a fresh preview for this same post if it has expired.

### Destination persistence defect discovered during live verification

Scheduling acceptance was paused while correcting a confirmed draft-persistence
bug. The composer kept checked accounts in component-local state, while its save
payload and database command persisted only copy/media. MCP preview preparation
kept the requested account inside its operation but did not save draft intent.
Thus a correct preview and an empty composer selection could coexist, and a
manual selection disappeared after Save draft plus reload.

The corrective implementation adds `social_post_draft_destinations`, separately
from dispatch targets. Browser saves commit selected accounts with copy/media and
the same optimistic revision; omitted IDs preserve them and an explicit empty
list clears them. The shared save validates workspace ownership, with composite
foreign keys enforcing both post and account tenancy. Composer and `get_post`
reads return the saved IDs, including unavailable selections for explicit removal.

`save_post` accepts optional `connectionIds`. When `prepare_publication` changes
the chosen accounts, one SQL transaction saves that intent, advances the draft
revision and creates the exact approval operation. Retries bind to the original
request while the preview uses the new revision; concurrent key/revision failures
cannot partially change another draft or mint another approval proof. No dispatch
target, schedule or provider task is created before separate human approval.
Cancellation and previously approved schedules keep their existing dispatch path.

Generated migration `20261104104742_social_post_draft_destinations` adds the table
and tenant constraints and backfills existing targets without altering them. It
passed isolated PostgreSQL tests and a temporary production-clone check: all 14
valid existing choices were copied, all three foreign keys and the matching
Drizzle ledger entry exist, and post/target counts and content/state digests match
production. At migration verification, the test post was still a draft with no
targets. After explicit user
approval, the migration was applied to production and the temporary clone was
deleted. Production read-back confirmed 14 saved choices, all three foreign keys,
the matching migration hash/ledger entry and unchanged post/target digests.

The web correction is deployed as `27d2905d2027cf5c271d2ce8d55055bd1c33764e`,
Vercel `dpl_D6a6vY1CjcZo4o49s16G4C17GCp6`, production READY on the canonical
domain. Anonymous public-page, waitlist/signup, private composer/API, MCP challenge
and framing checks passed. No worker deployment or environment change was needed.
The user subsequently answered **We are good now** to the MCP/manual
save-and-refresh regression check. Accept destination persistence as live-verified.

Corrective verification passed: 2,830 Vitest tests (162 intentionally skipped),
all 15 isolated Playwright journeys, TypeScript, full lint with four existing
warnings, focused lint after the final error-handling changes, environment
placement, changed-file formatting/secret review and the production build. The
first full test run hit an unrelated five-second PDF extraction timeout while
lint/TypeScript were also running; the complete rerun passed with
`npm test -- --maxWorkers=2 --testTimeout=15000`. Provider and worker calls remain
mocked. The tested migration hash matches the generated file exactly.

After deployment, refresh the client's tool metadata, read the existing test
post's current revision and prepare a fresh preview for the same account/time.
Confirm that account is selected in the composer, then manually save/change/clear
a choice and reload to verify persistence before continuing scheduling acceptance.
Do not approve an old pre-fix preview or create another copy of the test draft.

### Saved schedule verified; cancellation is next - 2026-11-04

Following the persistence confirmation, a bounded exact-workspace/post production
read found the existing draft already scheduled:

- Post `9206ff25-759c-4d9d-9913-64a646306288`, version 8, `status=scheduled`.
- Scheduled instant `2026-11-11T07:00:00.000Z`, timezone `Africa/Kampala`,
  equivalent to 11 November 2026 at 10:00 local time.
- One saved destination and one actual target: personal LinkedIn **Tamale Frank**,
  connection `9def266d-fabd-4e4c-a7c0-0eaa1f0173d3`.
- Operation `127ac3b0-8e49-4f5d-9b0c-4db99878352a` is `publish_post`, succeeded,
  and records the exact post with `scheduled=true`.
- Target status is pending, with no external post ID or publication timestamp.

Accept saved scheduling as verified. Do not prepare a duplicate schedule. This
does not establish future scheduled delivery or a separate client calendar read.
The next user-side prompt reads the calendar and prepares `action=cancel_schedule`
for this same post, its current version and exact target IDs. The user must review
and click **Approve cancellation**; **Cancel request** merely dismisses a preview.
The coding session made only SELECTs; the subsequent cancellation result is
recorded below.

### Cancellation verified; Claude web is next - 2026-11-04

The user reported **Done and successful** after the cancellation-review prompt.
A bounded exact-workspace/post production SELECT corroborated:

- Post `9206ff25-759c-4d9d-9913-64a646306288` is draft, version 9, with
  `scheduled_at=null`; its name/content and one saved destination remain.
- Cancellation operation `50d4b938-9a13-4d2a-8e05-14433acf3f7f` succeeded and
  records `cancelled=true` for this exact post.
- No destination is queued, publishing or published, and none has a publication
  timestamp or external post ID. Cleared scheduling removes it from the future
  scheduled-calendar range; no new public post was sent by this test.

Accept scheduling and cancellation as passed. The client in these latest replies
was identified only as connected ChatGPT; do not assign a new independent
web-versus-desktop result. Do not recreate the schedule to repeat this check.

The next user-side check is Claude web OAuth and read-only project listing.
Configure the canonical MCP URL using OAuth and the published Claude identity
when offered, sign in with an existing allowed owner identity, then invoke
connection discovery. A new connection initially has no workspace authority.
Grant **Read** only to the new Claude connection in VCStudio, leaving the existing
ChatGPT grants intact, and list projects without mutations. Add editing/media and
review/publication grants only when their respective acceptance steps need them.
The user subsequently confirmed Claude web lists projects successfully. Accept
Claude web OAuth/workspace/project reads as user-verified. File/import/edit/review
journeys and Claude desktop remain separate pending checks.

### Claude web draft and browser upload fallback verified

Retain Read and add Edit and Media only to the new Claude connection for the
selected workspace. Create or reuse a dedicated draft named **Claude web MCP
verification 2026-11-04**, save the exact text **Claude web MCP verification**, and
request `import_asset` with `source.kind=upload`, title **Claude web import test**
and that draft's `destination.postId`. Use a stable idempotency key for retries.
The assistant should present the signed-in handoff, not claim access to an
unavailable chat file or start generation.

The user selects an existing image in the VCStudio handoff page. After completion,
Claude checks `get_operation`/`get_asset`, verifies ready media, reads the current
post revision and attaches the new asset through `save_post`. The import preserves
the destination hint but does not itself attach the image, so that final draft save
is necessary. Do not attach it twice or overwrite an unrelated draft. Read back
the exact text, attachment and operation/asset/post IDs. No project, generation,
render, publication or schedule is needed. Browser fallback acceptance does not
establish native Claude chat-file transfer.

The user reported the completed flow; a bounded workspace/import/asset/attachment
production SELECT corroborated:

- Import `9dcf39a8-b705-4190-9081-ff60a428c0c9` succeeded with source kind upload,
  `inspectionPending=false`, provenance and a frozen accepted upload copy.
- Asset has the same ID, title **Claude web import test**, original filename
  `jake-character-sheet.png`, PNG, 1672 x 941, 2,129,282 bytes, ready, no warnings.
- Its intended and actual post is `3135ab16-8439-42af-83a6-09a896b488f6`, named
  **Claude web MCP verification 2026-11-04**, version 3, exact text **Claude web MCP
  verification**, still draft, no schedule or publication targets.
- The ready library asset has one matching attachment on that post.

Accept Claude web draft saving and browser-upload fallback/attachment as passed.
This does not establish native Claude attachment access or its approval UI path.

Two reported observations are intentional:

- `inspectionStatus=null` on this image does not mean validation was skipped.
  `finishMcpImport` verifies actual byte size, supported image format and decoded
  content through Sharp before marking it ready. The asynchronous inspection
  status and verified-metadata union describe video/audio FFprobe inspection;
  those uploads must complete that separate worker path before use.
- One import deliberately uses its operation UUID as the media asset UUID.
  `authorizeMcpUpload`, completion, recovery and import status lookup all follow
  this deterministic identity for retry safety. The records remain separate,
  workspace-scoped entities with explicit operation/media fields and provenance.
  A shared UUID alone is not an accidental collision or evidence of a defect.

No runtime fix is required for these observations. All seven existing
import-service tests passed when rerun for the raised validation concern,
including real Sharp decoding and disguised/oversized file rejection.

### Claude Desktop reads passed; upload and reuse are next

The user explicitly ran Claude Desktop and confirmed active/non-revoked
connection, owner workspace access, exact draft version 3/text, the one ready
attached PNG and 1672 x 941 dimensions. Accept desktop reads as user-verified.
This does not yet establish desktop transfer, editing, scene reuse or review.

Next, retain Read/Edit/Media and add Review on the Claude workspace grant. In
Claude Desktop, create or reuse **Claude desktop MCP reuse verification
2026-11-04** with 16:9, 30 fps, English and a zero project budget. Save the exact
script draft **Claude desktop MCP verification**, keeping the script unapproved.
Create and explicitly approve one manual scene with that narration and a brief
to show the full uploaded image. No analysis or provider generation is needed.

Request a browser image-upload handoff titled **Claude desktop import test**,
retaining this exact project/scene destination. After the user selects an existing
image in VCStudio and the operation/asset are ready, assign that imported asset
through `assign_scene_image` with contain fit and the current scene revision.
Preserve the library original and leave the scene image pending review. Return
project, scene, import, asset and assignment IDs plus read-back. Reuse request keys
on retries and do not duplicate the test project/scene/import. No rendering,
publication or scheduling belongs in this check. The live result is pending.

For the later Claude checks, follow the current official
[custom remote connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp),
use the canonical `https://vcstudio.veilcode.studio/mcp` URL, OAuth sign-in and
Claude's published client identity when offered. Grant only the selected owner
workspace in VCStudio. Start with connection/project reads before any mutation.
Validate web and desktop separately; support for a remote connector does not
establish automatic access to chat-generated files.

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

| Client          | Remote OAuth/MCP                      | Native chat files            | Interactive approval | Browser/upload fallback     |
| --------------- | ------------------------------------- | ---------------------------- | -------------------- | --------------------------- |
| ChatGPT web     | OAuth/reads user verified             | File-reference import passed | Not run              | Local fixtures only         |
| ChatGPT desktop | Tools/project reuse verified          | Not run                      | Not run              | Local fixtures only         |
| Claude web      | OAuth/project reads verified          | Not run                      | Not run              | Upload/draft attach passed  |
| Claude desktop  | Connection/draft/asset reads verified | Not run                      | Not run              | Desktop upload test pending |

The production database, Clerk resource/scopes and deployment prerequisites are
complete. The user explicitly approved the controlled rollout on 2026-11-04.
Production web and Trigger.dev now use `ENABLE_MCP=true`; Vercel Preview, local
`.env` and `.env.example` remain false. The ignored `.env.vercel` and `.env.trigger`
files mirror their production flags. Marketing remains paused and the seven
existing schedule activation states and intervals are unchanged.

The user has reported a successful authenticated ChatGPT web request through the
production handler, which enforces the canonical token audience. No raw token was
collected or separately inspected. Workspace/project reads, one image import and one attached Social draft are verified
as recorded below. ChatGPT desktop project/script/manual-scene operations and image
reuse are also verified, and the user subsequently confirmed a real LinkedIn
text-and-image publication. Scene-image approval is also now corroborated as
recorded above. Scheduling and the remaining
client workflows are still acceptance gates. Never weaken audience validation.
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
The deployed web discovery returns HTTP 200 for the canonical resource. The first
ChatGPT web authentication succeeded according to the user report below; broader
client workflows still need live testing.

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

On 2026-11-04 the user reported that ChatGPT web connected successfully and the
API responded: authentication valid, connection not revoked, no workspaces granted,
Marketing paused, and AI generation not exposed. ChatGPT could not retrieve content
without a workspace grant. This accepts the initial connection check only; native
chat files, interactive approval and end-to-end content journeys remain untested.

The user subsequently reported successful authorization for VeilCode Studio
(`veilcode-studio-68d39c29`), owner role, with Read, Edit, Media, Review and Publish
grants. ChatGPT retrieved the one authorized workspace and seven project records.
This accepts workspace/project reads in ChatGPT web. Subsequent import and Social draft tests are recorded below. Scene review and
publication operations still need live verification. Publishing still
requires the separate human approval of each prepared operation.

Code inspection explains the reported `planning` plus `hasPublished: true` records:
`listProjects` derives the flag from any `videoPublications.status = succeeded`
record in the workspace; project status is a separate production lifecycle with no
`published` enum value. Publication completion updates the publication record, not
project status. A successful record can also represent platform inbox delivery,
so the flag alone does not establish a currently public post. No project status
was changed based on this observation.

### Image import and Social draft verified - 2026-11-04

The user confirmed the image imported and the Social draft was created with internal
name and description/text `MCP import test`. A bounded read against the exact
workspace and test post independently corroborated:

- Post `ade9399e-dc02-450f-9284-d4634f392163`: matching name and plain text, status
  `draft`, no scheduled time, and the imported image attached.
- Asset `1fa9e033-3186-42f9-946c-945297d97891`: kind `image`, status `ready`.
- Its import operation succeeded with `sourceKind: file`, exercising the MCP file
  reference adapter. This does not establish access to every generated ChatGPT
  image, or test the alternative URL/upload paths.

The subsequent zero-budget project/script/manual-scene and full-image reuse test
passed in ChatGPT desktop, as recorded below. Publication/scheduling approval and
remaining client paths stay pending. Marketing remains paused and LinkedIn Pages
remains on hold.

### Project creation regression and correction - 2026-11-04

The user's next test was blocked by `invalid_input` before creating the project.
The same request failed through the real SDK locally with both zero and positive
budgets. Omitted reference selectors normalize to null in the existing project
schema. The SDK returned that validated output, but the generic wrapper and project
service each parsed it again as input, rejecting normalized null values. Budget
validation was not the cause; the supported minimum remains zero.

The registrar now passes the SDK-validated output through a typed Standard Schema
interface without reparsing it. The project service accepts the validated output;
workspace grants, role checks, selector restrictions and durable idempotency still
apply. The original browser schema was not weakened. Application Zod error results
now include up to eight field/message pairs, with bounded lengths and no rejected
input values; SDK-level invalid fields remain identified by its validation errors.

Regression tests exercise the actual SDK, content registration and project service
with mocked persistence: zero/positive budgets, omitted/empty options, numeric
coercion, retry reuse, changed-key inputs, denied grants, unsupported reference IDs
and invalid fields. A separate transformed-output test guards all registered tools.
The relevant 116 MCP/project tests, TypeScript, environment checks, changed-file
formatting, lint (four existing warnings) and production build passed.

This is a web-only correction. It needs no schema, migration, dependency, environment
or worker deployment changes. Keep the existing imported image and Social draft.
Corrective commit `3301fd4` deployed successfully in Vercel production deployment
`dpl_S3QvumpPysyvGrFJiNhuyMNCZkKZ`. The user then completed the reuse test from
ChatGPT desktop with the zero budget unchanged.

### ChatGPT desktop project/script/scene reuse verified - 2026-11-04

The user deliberately switched to ChatGPT desktop for the reuse test and confirmed
the results in VCStudio. A bounded read scoped to the known workspace, project and
scene independently corroborated the saved state:

- Project `347cddbd-db2c-473d-939a-488111fc49e0`, **MCP reuse test**, 16:9,
  1920 x 1080, 30 fps, English, maximum budget zero, status draft.
- Script draft exactly `This is an MCP reuse test`, revision 1.
- Manual scene `afa983f5-da55-45a7-8596-1bed0cb0b448` approved.
- Assigned image `0726730b-13f6-4208-b035-b982dd1c06f2`, uploaded-image source,
  succeeded, review pending, actual assignment cost zero, contain framing.
- Provenance links it to existing library asset
  `1fa9e033-3186-42f9-946c-945297d97891`, still ready. A boolean comparison confirmed
  different object keys for the project image and shared original without selecting
  or displaying either key. This corroborates an independent project-owned copy.
- The user visually confirmed the portrait's complete content fits within the wide
  composition. No crop, paid generation, render, publish or schedule was requested
  or initiated as part of this journey.

This accepts these desktop tool operations, not desktop native file import or
interactive MCP Apps approval. The earlier file-reference import and Social draft
were tested in ChatGPT web. Both clients still need publication-review/approval
acceptance, with actual publication/scheduling only after explicit human review.
Claude web/desktop remain untested. The next publication test can stop at an exact
preview for a user-selected eligible destination; the existing scene image remains
pending review until separately requested.

### Publication preview observed; private-image CSP corrected - 2026-11-04

The supplied ChatGPT screenshots show destination selection followed by an exact
preview of `MCP import test`, draft version 3, one imported image and the selected
LinkedIn personal-profile destination Tamale Frank. The operation requires approval;
the original Social post remains a draft without a schedule or applied publishing
destination. These screenshots accept preview preparation and display of the
approval boundary, not successful approval/execution or scheduling. They follow
the desktop test but do not separately verify the web review path.

The actual **Review publication** widget displayed a broken image. A local-only
signing check against the production runtime file confirmed that the signed URL's
bucket-prefixed origin differed from the widget's base-endpoint allowlist. No R2
request was made and no signed URL/credentials were printed. A real SDK resource
regression reproduced the wrong origin before the correction.

`getMcpMediaPreviewOrigin` now obtains only the origin from the same download signer
used for private media previews. This handles virtual-hosted and path-style buckets
without guessed hostname rules, wildcards or extra network access. The ephemeral
probe URL is discarded; actual preview URLs remain private UI metadata. The resource
uses the standard `ui.csp.resourceDomains` surface documented in the
[OpenAI reference](https://developers.openai.com/plugins/reference). Normal site
framing headers and the widget's empty connection-domain allowlist stay intact.

Verification passed: 122 relevant MCP/project tests across 17 files, eight isolated
Playwright journeys, TypeScript, lint with four existing warnings, environment
placement, changed-file formatting and the production build. Tests include real SDK URL signing for virtual-hosted/dotted/path-style
endpoints, exact resource CSP metadata, private URL exclusion from model content,
and actual image decode/display under restrictive CSP in Light/Dark mobile layouts.
An unlisted image origin is blocked before any network request. Approval is not
triggered by image display. Storage/providers/workers remain mocked in verification.

The correction deployed as `f4f0d08edad03ecf8a055afac7a259c503c8085c`, Vercel
`dpl_AdVaKUTymW9v9GQ2FGQV5ezQTE4F`, production READY. Discovery, OAuth challenge,
origin rejection and site framing protection were checked after deployment.

The user subsequently answered **Image displays correctly** after being asked to
refresh the VCStudio connection and prepare a fresh preview. Accept the live image
preview as passed. No approval execution, post publication or schedule creation was
reported, so those gates remain open. The confirmation does not add separate
Claude or web-versus-desktop compatibility results.

For future widget policy changes, refresh the connection metadata and create a
fresh preview because resource policies may be cached and approvals expire after
ten minutes. Keep Marketing paused and LinkedIn Pages on hold.

### First real publication and private-access restriction - 2026-11-04

The user confirmed the first live LinkedIn personal-profile publication succeeded
with both text and an image. Accept this as user-verified publication of a real
post; do not infer scheduling, Claude compatibility or a separate client-specific
approval run from that report. No additional post was created for this access
restriction.

MCP remains enabled for the existing approved owner identities. The global
private-development gate now checks the verified OAuth subject before looking up
or synchronizing an application user. Valid tokens, scopes and workspace grants
cannot bypass `ENABLE_PRIVATE_ACCESS=true` and the configured Clerk owner IDs.
Outsider OAuth calls return permission denied (HTTP 403). Existing owner scopes,
workspace grants, connections and approved schedules are preserved. Public OAuth
discovery remains available. See [private access](private-access.md).

The user subsequently verified normal sign-in, working waitlist registration,
clear blocking feedback for new users and continued availability of the existing
MCP connection after private-access release `9ae2aa1`. This confirms access
continuity, without adding another client-compatibility or scheduling result.
