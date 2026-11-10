# MCP image and narration generation

Implemented and verified locally, 2026-11-10. The owner approved production migration, OAuth setup, matching worker/web release and autonomous generation for the two existing owner connections. The migration is applied and worker `20261110.1` is deployed. Clerk dashboard scope/client changes, web deployment and grant updates remain pending. This is not a completed web release confirmation.

The owner requested end-to-end agent operation for both standalone library assets and existing project scenes. YouTube Community publishing remains on hold: YouTube's [public Data API reference](https://developers.google.com/youtube/data/reference/rest) exposes no supported Community-post creation endpoint. Video generation and Marketing remain paused.

## Authorization and execution

`vcstudio:generate` is a separate OAuth scope and workspace permission. Existing grants default to manual generation approval. Only an owner with Generate media permission can save autonomous generation for a connection/workspace. Publishing approval remains a separate setting. OAuth consent, current membership, feature flags, exact scene revisions and existing budgets continue to apply.

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

## Release prerequisites

The generated `20261110001516_mcp_media_generation` migration adds a default-manual grant setting, nullable operation links for scene media and standalone usage, a media-generation ledger type and tenant/idempotency constraints. It passed isolated PostgreSQL tests and a temporary production-clone test. After explicit owner approval it was applied to production, with SHA-256 `1d121cc93ead55844504837a9ec2c0453defdf2dc9ad6e68da6364cf55e51934` recorded as Drizzle row 88. All six constraints validated; the 51 projects, 37 posts, 123 assets and 566 reservations are unchanged. Only test branch `br-damp-thunder-ai33b1b9` was deleted. Existing production grants still have manual generation and autonomous publishing until the approved grant update follows the web release.

1. Create **Generate images and audio**, key `vcstudio:generate`, in Clerk's OAuth scope catalog and advertise it. Preserve the existing five scopes.
2. Add the new key to allowed/default scopes and the existing ChatGPT/Claude CIMD client scope ceilings. Preserve identity scopes, automatic `offline_access`, PKCE, JWT audience binding, client admission and the existing resource URI. Do not put `offline_access` in the instance default-scopes list.
3. Apply the approved migration and record its Drizzle migration hash. Deploy matching workers before the web app. No new scheduled job or provider credential is needed.
4. Reconnect each client once to consent to the new scope. Grant Generate media and select the desired generation approval mode for the intended workspace. Keep publishing approval independent. Any rollout changes to the owner's existing grants require explicit owner authorization; other grants stay manual.

Saving grants and deploying start no paid work. Verification uses mocked providers/workers; live paid generation is not a release test. This extension does not add script-generation, subtitles, video-generation, rendering or administration tools. Assistants can still write scripts in the conversation and save them through the existing editing tools.

## Verification

Server version `1.2.0` registers 47 model-facing tools and two app-only approval tools. Formatting, full lint (three existing warnings), TypeScript, environment placement and the production build passed. The full suite passed 3,314 tests with 163 existing opt-in tests skipped; 31 distinct browser journeys passed, including responsive Light/Dark review, embedded approval, browser fallback and independent approval settings. Local tests cover private proof replay, quote expiry/revisions, role/scope isolation, revocation, repeated execution, malformed outputs, speech segmentation costs, uncertain provider outcomes and recovery racing a newer worker. No billable provider call, public post or schedule was used for verification.
