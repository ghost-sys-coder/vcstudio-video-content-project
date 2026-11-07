# Social video publishing

## YouTube videos and Shorts

Attach one ready video to a Social draft. The **YouTube upload** panel holds the
video title, description, tags, visibility and the creator's explicit audience
and realistic altered/synthetic-content declarations. Both declarations begin
unanswered and block publication until supplied. An unset title uses the first
line of the post; an unset description uses the shared post text. An explicitly
empty description stays empty. These same values appear in MCP human review.
Cancel an existing schedule before changing its YouTube settings or thumbnail;
the scheduled destination keeps the exact metadata captured at scheduling.

Choose a separate ready JPEG/PNG library image as the custom thumbnail. It is
not a second post attachment. Existing library upload limits still apply;
YouTube's current thumbnail endpoint accepts up to 50 MB. Use 16:9 artwork for
long-form and 9:16 artwork for Shorts. The channel must have permission to set
custom thumbnails.

YouTube classifies square/vertical videos of at most three minutes as Shorts.
VCStudio uses the same upload API for both formats. A confirmed upload ID is
checkpointed before finishing. Before setting the thumbnail, the worker checks
the owner-visible processing status, with at most 30 checks ten seconds apart.
It applies the image only after `processingStatus=succeeded`. Failed or delayed
processing leaves an actionable thumbnail outcome beside the existing video.
**Retry thumbnail only** queues finishing for that same video ID; it never
uploads the video again. No recurring poller or scheduled task is added.

Project publishing history also exposes **Retry thumbnail only**. It reuses the
existing `video-publish` worker in a thumbnail-only branch, preserving the
uploaded publication and leaving caption/playlist outcomes untouched.

Current Google references: [thumbnail endpoint](https://developers.google.com/youtube/data/reference/rest/v3/thumbnails/set),
[Shorts classification](https://support.google.com/youtube/answer/15424877),
[custom-thumbnail permissions](https://support.google.com/youtube/answer/72431).

## MCP

`save_post` accepts optional `youtubeSettings` (title, nullable description,
tags, visibility, nullable `madeForKids` and `containsSyntheticMedia`) and
`youtubeThumbnailAssetId`. Omission preserves existing values; null clears them.
Import a thumbnail through the existing asset tools, then select its ID here,
without putting it in the video's `mediaAssetIds` list. Read current versions
before saves and reuse an idempotency key only for identical retries.
Omit `mediaAssetIds` when changing upload details to preserve existing attachments,
including project renders. An explicit empty array clears the attachments.

`prepare_publication` validates the saved metadata and thumbnail, binds the
exact metadata and image ETag into the immutable preview. Manual connections
require single-use human approval. Owner-enabled autonomous connections use
`execute_publication` with that operation ID and the same preparation idempotency
key. Changes invalidate old previews. See [approval settings](mcp-setup.md#optional-autonomous-publishing).
`get_post` reports the settings, thumbnail ID and per-destination thumbnail outcome.

For an unfinished thumbnail on an uploaded YouTube destination, prepare
`action: retry_thumbnail` for the current post version and exactly one existing
connection ID, without a scheduled time. The review shows the existing video ID
and original selected thumbnail. Execution dispatches finishing only and follows
the connection's saved approval mode. A model's ordinary arguments cannot replace
human UI approval on a manual connection or enable autonomous permission.

## TikTok during sandbox/inbox access

VCStudio continues to request `video.upload` and sends videos to the TikTok
inbox. `inbox_delivered` means the API confirmed delivery; it does not mean a
public post exists. The target has no `publishedAt` or fabricated post URL, and
the aggregate post shows **Finish in TikTok** while completion remains there.
Already delivered accounts are preserved and excluded from ordinary retries.

The inbox API uploads video bytes only; Social text remains a caption reference.
Open the inbox notification in TikTok to add the caption, finish editing, choose a video cover
frame and post. Inbox uploads cannot carry `video_cover_timestamp_ms`; that
field belongs to Direct Post and its `video.publish` permission. VCStudio/MCP
therefore do not offer cover selection or scheduled inbox delivery with current
permissions. [TikTok upload reference](https://developers.tiktok.com/docs/en/content-posting-api-reference-upload-video).

No background status sweeper is introduced. Historical Social rows marked as
published are not reclassified without provider confirmation. Live final TikTok
completion is outside this release's inbox-delivery guarantee.

## Database and release

Generated migration `20261107211352_social_video_publication_settings` adds two
Social status values, nullable YouTube settings and thumbnail references on
drafts/targets, and per-target thumbnail finishing state/error. Composite foreign
keys bind thumbnails to the same workspace; status checks limit inbox delivery
to TikTok and thumbnail states to YouTube. Existing media and publication records
are preserved. Test against isolated PostgreSQL before applying to production.
Apply the migration before releasing matching web and publishing workers.

There are no new environment variables or dependencies. Existing YouTube OAuth,
private storage, encryption and feature flags apply. Marketing stays paused,
LinkedIn Pages stays on hold, and Google video generation remains on hold.
Verification uses mocked platform requests/workers and isolated database/browser
fixtures, without uploading to real channels or generating media.

### Verification and production rollout — 8 November 2026

- The publishing, Social, MCP, schema and isolated PostgreSQL regression suite
  passed 634 tests across 82 files. This includes real adapter/provider wiring,
  missing disclosures, bounded processing checks, confirmed-upload reuse,
  thumbnail-only finishing, workspace constraints and stale approval rejection.
- All 29 browser journeys passed, including Light/Dark at 390px and 1440px,
  saved thumbnail/metadata persistence, embedded reviews, attachment recovery
  and existing approval flows. Saved UI screenshots were inspected.
- Formatting, TypeScript, environment placement and production build passed.
  Full lint passed with three pre-existing warnings in unrelated files; changed
  files have no lint findings. Google Fonts required network access for the build.
- Production-clone verification applied the generated migration to
  `br-dry-moon-ai9if1il` and recorded its original Drizzle hash. Post, target,
  media and connection counts/fingerprints stayed identical to production.
- After explicit user approval, the migration was applied to production branch
  `br-orange-fog-aiank0jx`; its original Drizzle hash/timestamp were recorded.
  Existing business-table fingerprints remained unchanged, all six columns are
  nullable and the four tenant/status constraints were verified. Only temporary
  branch `br-dry-moon-ai9if1il` was deleted.
- Web commit `b83350e` is READY in production as
  `dpl_69uBjLUzL5XsioquAoJqRQeXyLHR`, serving `vcstudio.veilcode.studio`.
  Matching Trigger.dev production worker `20261107.1` deployed successfully
  (deployment `jv8itzvk`). Environment synchronization was explicitly skipped;
  existing production configuration and recovery frequencies remain unchanged.
- Production landing, sign-in and waitlist returned 200; private Social access
  redirected to sign-in; MCP discovery returned 200 and an unauthenticated MCP
  request returned its expected 401 OAuth challenge. Existing authenticated MCP
  connection/workspace reads succeeded and advertised the new YouTube features
  and TikTok inbox-only restrictions. An immediate production error/fatal log
  scan returned no groups. No real video was uploaded or published,
  so channel-specific thumbnail permission and live upload acceptance remain
  subject to a deliberate creator-approved publication.
