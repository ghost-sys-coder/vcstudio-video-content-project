# ElevenLabs in-house media service

VCStudio uses the owner's server-side `ELEVEN_LABS_API_KEY`. The integration is
restricted to the private in-house deployment. Broad API-key permissions are not
permission to resell ElevenLabs services, enrol new voices, or spend credits in tests.

## Available workflows

- Narration presets select an existing account voice, including owner-created
  voices. The picker loads 30 voices on demand with explicit pagination. No voice
  cloning, voice deletion or account administration is exposed.
- Shared narration workers and standalone MCP audio use the same adapter,
  estimates, workspace/project budgets and optional MCP autonomy. MP3, 24 kHz WAV
  and Opus are supported at 70–120% speed. Free-form delivery instructions are not
  accepted by this TTS endpoint; scene direction remains recorded in VCStudio but
  is not silently sent as spoken text. Existing providers/defaults stay unchanged.
- The shared image provider supports ElevenLabs GPT Image 1.5 for scenes,
  storyboard shots, character references/animation poses, publish thumbnails,
  output-variant edits and standalone MCP library images. Up to five references
  are allowed. Images are decoded, bounded and copied into private R2. The saved
  model is namespaced `elevenlabs/gpt-image-1.5`, so a configuration change cannot
  silently redirect queued work to a different provider.
- Video Studio and project footage support documented ElevenLabs Veo 3.1/Fast
  HTTP APIs (720p and 1080p). Text, first/last frames and up to three subject/style references use
  existing video validation, queues, inspection, R2, scene review and cost ledger.
  Reference mode requires eight seconds. Independent clips may keep native sound;
  project clips retain the existing narration workflow. ByteDance models and
  undocumented app-only model endpoints are not exposed.
- MCP discovers availability through `get_generation_options`, lists account
  voices through `list_generation_voices`, and saves presets through
  `create_generation_voice_preset`. `assign_scene_video` and `review_scene_video` reuse and review exact inspected footage through shared browser services. Existing `prepare_generation`,
  `execute_generation`, `get_generation_status` accept `kind: video` with an exact
  `video` request. Generate scope, saved workspace grants, membership, cost caps
  and manual/autonomous generation remain enforced. Publishing is still separate.

## Deployment controls

All following keys belong in local, web and worker configuration. Only
`.env.example` is tracked. Never send the key or provider download URLs to clients.

| Variable                                           | Default / purpose                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| `ENABLE_ELEVENLABS`                                | `false`; master kill switch for every modality                           |
| `ELEVEN_LABS_API_KEY`                              | Server-only owner key                                                    |
| `ELEVENLABS_USAGE_MODE`                            | `internal`; commercial mode needs separate review                        |
| `ELEVENLABS_INTERNAL_DEPLOYMENT`                   | `false`; explicit private-deployment assertion shared by web and worker  |
| `ELEVENLABS_COMMERCIAL_LICENSE_CONFIRMED`          | `false`; blocks commercial mode until service licensing is reviewed      |
| `ELEVENLABS_VISUALS_ENABLED`                       | `false`; image/video API access requires active Pro or higher            |
| `ELEVENLABS_TTS_MODEL`                             | `eleven_multilingual_v2`; also supports `eleven_v3`, `eleven_flash_v2_5` |
| `ELEVENLABS_TTS_COST_PER_MILLION_CHARACTERS_CENTS` | `30000`; conservative credit valuation, not incremental cash billing     |
| `IMAGE_GENERATION_PROVIDER`                        | `openai`; deployment choice for all shared image workflows               |
| `ELEVENLABS_IMAGE_PRICING_JSON`                    | `[]`; nine distinct quality/size prices required before image generation |

Internal mode requires the deployment assertion and refuses a web environment
where `ENABLE_PRIVATE_ACCESS=false`. The worker uses the explicit internal
assertion without copying web-only Clerk allowlists. At a public launch, remove
the assertion from both runtimes and leave ElevenLabs disabled unless the exact
commercial service use is licensed. This is an operational guard, not a legal
determination. Disabling preserves existing assets and other providers.

## Plan and pricing limits

Non-billable checks of the supplied key on 10 November 2026 reported an active
Creator subscription. Voice access is eligible. ElevenLabs documents **Pro or
higher for image/video HTTP API calls**; broader key permissions do not override
that requirement. Visual calls are disabled locally until eligible. No upgrade or
paid test was performed.

Visual enablement requires `ELEVENLABS_VISUALS_ENABLED=true` and configured
conservative rates. Image prices are an array containing each of low/medium/high
and 1024x1024/1024x1536/1536x1024 exactly once, with `reservedCostCents` covering
the entire request including references. Video prices use existing validated
`VIDEO_GENERATION_PRICING_JSON` for the two `elevenlabs-veo-*` model IDs. Missing
prices fail closed. `ENABLE_VIDEO_GENERATION` remains a separate global switch.
Google's billing hold is unchanged; MCP video exposes ElevenLabs only.

Estimates value consumed subscription credits conservatively. They are not a
live credit balance or a promise of a new cash charge. TTS records the provider's
charged character count when returned. Image/video APIs do not return measured
credit usage in their terminal response; these operations retain the approved
conservative reservation, labelled accordingly, instead of inventing usage.

The async image/video POST runs once. Remote job IDs are persisted before
polling/download. Ambiguous submissions, polling timeouts and interrupted output
processing never authorize a second billable POST. Failed visual generations are
reported by ElevenLabs as uncharged. Downloads use existing DNS-pinned SSRF
checks and byte limits, without forwarding the API key. No new scheduled job is
introduced.

## Verification and release

Use mocked ElevenLabs responses and isolated PostgreSQL. Do not consume credits
to test UI. Apply the generated nullable video/MCP ownership migration before
deploying the matching worker and web code. Refresh MCP tools after release;
existing Generate OAuth scope is sufficient. No new OAuth grant is added.

Primary references: [TTS API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert),
[image/video API guide](https://elevenlabs.io/docs/eleven-api/guides/cookbooks/image-and-video),
[image API](https://elevenlabs.io/docs/api-reference/flows/image/create),
[video API](https://elevenlabs.io/docs/api-reference/flows/video/create).

## Verification record — 10 November 2026

The full regression run passed 3,353 tests (160 existing opt-in skips). Final
provider/MCP/authorization/SQL suites passed 464 tests. All 21 mocked browser
journeys passed, including responsive Light/Dark voice presets, disabled-service
retry, and exact video approval/credit valuation. No billable provider request was
used. The final production build passed. TypeScript, environment placement and changed-file formatting pass; lint
has only three existing warnings. The full formatting check reports 1,486 existing
files outside this change. The dependency audit reports 76 existing advisories;
none involve either newly installed package (ElevenLabs SDK and command-exists).

The generated migration passed isolated PostgreSQL tenant/uniqueness tests and a
production-clone check. Existing records are unchanged: 51 projects, 37 Social
posts, 123 assets, 23 connections, 566 usage reservations and one existing video.
Production migration, environment publication and worker/web deployment require
release approval. Temporary Neon test branch `br-floral-voice-aibsc8np` must be
removed through the approved migration-completion workflow.
