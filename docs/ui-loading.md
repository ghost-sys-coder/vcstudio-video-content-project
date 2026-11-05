# UI and asset loading

Loading indicators describe a real pending request. They do not replace limiting the work that request performs. Keep Marketing Studio paused during verification; use mocked data instead of starting workers or calling providers.

## Media library and pickers

- The library reads 24 ready, non-deleted workspace assets plus one pagination sentinel. Only the visible 24 receive signed preview URLs. Previous/Next links preserve the kind filter and do not prefetch another data page. Audio has its own filter.
- Cursor boundaries order by creation time and ID. The database resolves the anchor's exact timestamp to preserve sub-millisecond precision, with the serialized timestamp as a fallback if it was removed. An emptied page retains a route back to the populated part of the library.
- Only the full library requests a total count. Post and brand asset pickers load a count-free page when opened, then load another page on explicit request. Opening a post or the brand assets page does not preload their picker libraries.
- Picker requests resolve permissions and the active workspace on the server. Browser-supplied workspace IDs have no authority. The post picker allows only images/videos; the brand picker requests images. Failed next-page reads preserve loaded assets and selection. Closing invalidates pending responses; reopening refreshes expiring URLs.
- Gallery images use browser lazy loading and asynchronous decoding in stable aspect-ratio containers. Clickable video/audio tiles render a type indicator without a media source. Detail and inline players use `preload="none"` and fetch bytes on playback. No thumbnail worker or paid transformation was added. Changing workspace, kind, or cursor remounts the Social library's local asset state.

## Shared page reads and image policy

- Post list/calendar media summaries use one narrow, workspace-scoped batch query rather than one attachment query per post. The normal Social lists do not request or sign unused previews. The Marketing calendar opts into previews; image tiles are lazy and videos are not requested as background images.
- Post lists omit rich-text documents they do not render. Composer attachment reads omit large render input snapshots and unused asset fields while retaining attachment order and unavailable-file states.
- The request-scoped workspace context reuses the authenticated user's already verified membership list to resolve the active cookie. Explicit authorization checks still perform their own membership lookup. Do not add a cross-request membership cache.
- Native image previews elsewhere in the application use lazy loading and async decoding. The small navbar workspace logo remains eager. Existing Next Image previews retain their default lazy behavior, and an image explicitly opened for review may load immediately. Recording metadata is fetched only for the selected recording.
- Private signed image URLs remain private and expiring. They are not persisted or sent through a new public image cache. Original image bytes are still served; responsive thumbnail variants and measured deployment latency remain future work.

## Application error recovery

- Social draft media appears above the upload area so selected files are immediately visible. Freshly uploaded videos can be saved in the draft while their existing background inspection runs; no preview or publication is allowed before verification. The composer offers an on-demand status check and does not poll while idle. An inspection failure remains visible and removable. Existing workspace and revision checks still apply.

- The shared application error boundary retries a server view by refreshing the router and resetting the boundary in one React transition. The shadcn retry button shows a spinner and “Trying again…” while the request is pending, disables duplicate submissions, and announces a visible status message. A failed retry keeps a usable retry control with explicit feedback; a successful retry replaces the fallback with the loaded view.
- The dashboard escape control remains a keyboard-accessible navigation link. Retry controls wrap within narrow containers and support Light/Dark themes and reduced motion.

## Verification

Unit and mocked integration coverage checks query scoping, bounded signing, cursor direction, empty windows, permissions, count-free picker reads, batch query count, and safe error messages. Isolated browser checks exercise form submission/reset, grouped and numeric selects, 40px adjacent control heights, nested dialogs, left-aligned post navigation, picker pagination/retry, and the absence of video downloads before playback. No live Neon, R2, Trigger.dev, or provider call is needed for these checks.
