# MCP image and narration generation

Released to production, 2026-11-10, after explicit owner approval. The migration, Clerk scope, worker `20261110.1` and image/audio generation are live. The current web protocol is `1.2.1`. Both existing ChatGPT/Claude owner connections have Generate permission and autonomous generation, with autonomous publishing preserved. Existing clients need one OAuth reconnection to consent to the new scope before generation becomes effective.

The owner requested end-to-end agent operation for both standalone library assets and existing project scenes. YouTube Community publishing remains on hold: YouTube's [public Data API reference](https://developers.google.com/youtube/data/reference/rest) exposes no supported Community-post creation endpoint. Video generation and Marketing remain paused.

## ChatGPT tool discovery and scope upgrades

Protocol update `1.2.1` adds the per-tool OAuth metadata and `mcp/www_authenticate` error challenge described in [OpenAI's authentication guidance](https://developers.openai.com/plugins/build/auth#triggering-authentication-ui). The server keeps all 49 tools discoverable with an older token, but never executes an unauthorized action. A missing OAuth scope requests additional consent, retaining existing known scopes. A missing workspace grant, revoked connection or denied role does not trigger OAuth as a workaround. Upload/file metadata, review resource URIs and UI-only proof protections are preserved.

The Generate wording on Clerk's consent page is a permission label, not a separate MCP tool. There are 49 registered tools: 47 are assistant-callable, and `confirm_publication`/`confirm_generation` are app-only human review actions. Compare actual names rather than assuming every client's counter includes app-only tools.

If Claude has generation while ChatGPT reports the previous 43-tool catalogue:

1. Open [ChatGPT Plugins](https://chatgpt.com/plugins), find the existing VCStudio plugin and use its management/details page to **refresh its tools**. This is the [documented tool refresh](https://developers.openai.com/api/docs/guides/custom-mcp-server#how-to-use); reconnecting credentials or refreshing a conversation alone is a different operation.
2. Confirm `get_generation_options`, `prepare_generation`, `execute_generation`, `get_generation_status` and `review_scene_audio` exist and are enabled. Preserve the existing connector URL and OAuth identity.
3. Reconnect to consent to `vcstudio:generate`, keeping the existing permissions, then start a new conversation. If Clerk rejects the new scope, check its allowed scope ceiling for the existing ChatGPT CIMD client, `https://chatgpt.com/oauth/client.json`; leave Claude's client and instance keys unchanged.
4. Read `get_connection`: `serverVersion` should be `1.2.1`, `oauthScopes` should contain `vcstudio:generate` and `missingOAuthScopes` should not. Then verify `get_capabilities.features.generation: true`. The already-saved autonomous generation/publishing modes are separate workspace grants and need no reset.

The user's Claude report verifies its new catalogue; the live ChatGPT read initially verified an old five-scope token and missing generation tools despite server `1.2.0`. Client refresh/re-consent remains a user-side step; a server deployment cannot rewrite a client's cached catalogue or an issued OAuth token. This repair starts no paid work and requires no worker deployment, migration or new environment variable.

## Authorization and execution

`vcstudio:generate` is a separate OAuth scope and workspace permission. New grants default to manual generation approval; the two existing owner grants were explicitly opted into autonomy during release. Only an owner with Generate media permission can save autonomous generation for a connection/workspace. Publishing approval remains a separate setting. OAuth consent, current membership, feature flags, exact scene revisions and existing budgets continue to apply.

Use `get_generation_options`, then `prepare_generation` with an explicit `maximumCostCents`. A preparation saves the exact prompt/narration, model, voice or image settings, reference identities and estimate for ten minutes. It never starts a provider call. Manual mode uses the embedded MCP Apps review or signed-in browser equivalent. Its single-use proof stays in private tool metadata. Autonomous mode allows `execute_generation` using the preparation ID and the same idempotency key, without asking the owner again. Use `get_generation_status` to inspect completion.

For scenes, an assistant with Review permission may explicitly approve a script version, current scene, scene image and scene audio using the review tools. These are ordinary authorized MCP actions, not human UI checkpoints. With Generate, Media/Edit/Review as needed, and autonomous Publish granted, an assistant can generate eligible content, save it in a Social draft, prepare publication and execute publication end to end. Client-side tool confirmation policies remain controlled by ChatGPT/Claude.

## Media paths

- `image`: a standalone private library image, using the configured OpenAI image model and optional ready library image references.
- `audio`: standalone narration using an existing OpenAI/Gemini catalogue voice preset and an MP3, WAV or Opus output. Up to four pause-separated spoken segments are permitted; each provider request is included in the estimate. `get_generation_options` reports the applicable character limits. Custom voices retain their existing scene-pipeline support; library custom-voice generation is not introduced in this release.
- `scene_image`: the existing current, approved scene-image pipeline with versioned style and prompt snapshots.
- `scene_audio`: the existing current, approved scene-narration pipeline, including its existing supported voices and delivery directions.

Generated library images are decoded before becoming ready. Library audio is measured and inspected by the existing worker tooling. Binary output stays in private R2; PostgreSQL holds operation metadata, provenance and usage. Scene results await explicit review; an authorized agent can perform that review itself.

## Spending and recovery

Generation always requires a quoted estimate within the supplied limit, workspace budgets and, for scenes, project budgets. The estimate is not a provider-enforced billing cap: final usage can differ and is recorded honestly. Standalone reservations use the existing core usage ledger with no dummy project. The image/audio workers share the existing queues. Standalone paid submissions have no automatic billable retry; uncertain attempts retain a conservative cost instead of silently being refunded and resubmitted. The existing half-hour recovery handles abandoned operations without a new schedule.

## Setup and released configuration

The generated `20261110001516_mcp_media_generation` migration adds a default-manual grant setting, nullable operation links for scene media and standalone usage, a media-generation ledger type and tenant/idempotency constraints. It passed isolated PostgreSQL tests and a temporary production-clone test. After explicit owner approval it was applied to production, with SHA-256 `1d121cc93ead55844504837a9ec2c0453defdf2dc9ad6e68da6364cf55e51934` recorded as Drizzle row 88. All six constraints validated; the 51 projects, 37 posts, 123 assets, 23 connected accounts and 566 reservations are unchanged. Only test branch `br-damp-thunder-ai33b1b9` was deleted. After web release, both existing owner grants were updated through shared ownership/role policies and audited with autonomous generation and publishing.

1. Create and advertise the exact key `vcstudio:generate` in Clerk's OAuth scope catalog. Its live display name is **VCStudio Generate**; the key, not the label, controls authorization. Preserve the existing five scopes.
2. Add the new key to allowed/default scopes and the existing ChatGPT/Claude CIMD client scope ceilings. Preserve identity scopes, automatic `offline_access`, PKCE, JWT audience binding, client admission and the existing resource URI. Do not put `offline_access` in the instance default-scopes list.
3. Apply the approved migration and record its Drizzle migration hash. Deploy matching workers before the web app. No new scheduled job or provider credential is needed.
4. Reconnect each client once to consent to the new scope. Grant Generate media and select the desired generation approval mode for the intended workspace. Keep publishing approval independent. Any rollout changes to the owner's existing grants require explicit owner authorization; other grants stay manual.

The first three steps are complete for the current release. The two owner grant changes are also complete. In ChatGPT and Claude, reconnect VCStudio once and refresh connector discovery/start a fresh conversation. Use `get_connection` to confirm version `1.2.1` and `get_capabilities` to verify `scopes` contains `vcstudio:generate`, `features.generation` is true and `generationApprovalMode` is `autonomous`. Old five-scope tokens remain valid for their original permissions and correctly report generation as false; a saved workspace grant cannot expand an already-issued OAuth token. If the new scope cannot be requested, check the existing client's allowed scope ceiling in the same Clerk instance; do not replace instance keys.

Saving grants and deploying start no paid work. Verification uses mocked providers/workers; live paid generation is not a release test. This extension does not add script-generation, subtitles, video-generation, rendering or administration tools. Assistants can still write scripts in the conversation and save them through the existing editing tools.

## Verification

The generation release in `1.2.0` registered 47 model-facing tools and two app-only approval tools. Formatting, full lint (three existing warnings), TypeScript, environment placement and the production build passed. The full suite passed 3,314 tests with 163 existing opt-in tests skipped; 31 distinct browser journeys passed, including responsive Light/Dark review, embedded approval, browser fallback and independent approval settings. Local tests cover private proof replay, quote expiry/revisions, role/scope isolation, revocation, repeated execution, malformed outputs, speech segmentation costs, uncertain provider outcomes and recovery racing a newer worker. No billable provider call, public post or schedule was used for verification.

Initial production verification confirmed authenticated MCP reads on `1.2.0`, both saved/audited owner grants, six-scope discovery, public landing/waitlist responses, signed-in settings protection and the standard unauthenticated MCP challenge. Initial deployment-scoped runtime inspection returned no error entries. No generation operations were created. Positive generation through newly consented client tokens remains a subsequent user workflow; release verification did not spend provider credits.

The `1.2.1` OAuth compatibility follow-up passed 273 focused MCP unit/integration tests and eight generation browser journeys, plus formatting, TypeScript, full lint (three existing warnings), environment placement and the production build. The first sandboxed build could not fetch existing Google Fonts; the network-enabled build passed. No paid provider call or worker deployment was used.

The web-only compatibility fix is deployed. Its live HTTP challenge includes Generate and initial deployment-scoped error inspection returned no entries. After refreshing/reconnecting, the user confirmed that Generate and all five new tools are available in ChatGPT; Claude's new catalogue was already confirmed. This accepts the reported permission/tool-visibility repair. The long-running agent host retains its old tool bridge (`Unknown tool`), so it did not independently read the refreshed token or execute generation. A paid generation journey is not part of this acceptance, and successful deployment alone is not evidence of client consent.
