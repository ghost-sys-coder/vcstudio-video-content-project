# Marketing Studio — content and publishing

## The rule

**Marketing never publishes.**

`social-post-scheduler` → `social-post-publish` remains the only path from this
application to a platform. Marketing generates content, gets it approved, and
hands it off as a `social_posts` row.

The manual publishing surface under `/app/marketing/publish` follows the same
rule. It is an alias over the existing Social composer and actions, not a second
provider path. Authors can upload ready media there, write shared copy, tailor
copy per selected platform, and publish now or schedule. Platform-specific copy
is validated against that platform's character limit and snapshotted on each
`social_post_targets.override_body_plain_text` row before a durable worker is
dispatched.

The reason is already written in `lib/social/create-post-from-render.ts`:

> a second publish path would be a second place for the capability matrix to
> drift out of agreement with the first.

That matrix (`lib/social/platform-post-capabilities.ts`) is what decides whether
a post is eligible for LinkedIn, X, Instagram, TikTok, Facebook, or YouTube. It
must have exactly one owner.

## Content lifecycle

```text
draft ──▶ needs_review ──▶ approved ──▶ scheduled ──▶ published
             │   ▲                                       │
             │   └──── changes_requested ◀───────────────┘ (never; terminal)
             ▼
          archived                                     failed
```

| Status              | Meaning                                                              |
| ------------------- | -------------------------------------------------------------------- |
| `draft`             | Generated or hand-written, not yet submitted                         |
| `needs_review`      | In the approval queue                                                |
| `changes_requested` | A reviewer left notes; back to the author or the AI                  |
| `approved`          | Cleared for handoff. **Does not mean scheduled.**                    |
| `scheduled`         | Handed off, and `scheduleSocialPostPublication` accepted it          |
| `published`         | The existing publish path reported success                           |
| `archived`          | Withdrawn                                                            |
| `failed`            | Generation failed; carries `error_category` and `safe_error_message` |

Transitions are enforced in `lib/marketing/content/content-status.ts` as a pure,
exhaustively-tested function — the same discipline the scene-state transitions
already use. Illegal transitions are rejected server-side, not merely hidden in
the UI.

### Auto-approve

`marketing_settings.require_approval_before_publish` defaults to `true`. A
schedule rule may set `auto_approve`, but only when the workspace autonomy level
allows it **and** the rule is owner-created — a rule may sit below the workspace
level, never above it.

Auto-approval is the last routine human step to be removed and it is the point
of the feature, not an edge case. The full gate list, the deterministic
brand-safety checks, and the criteria that unlock it are in
[`09-automation.md`](09-automation.md). Any failed gate routes the item to
review **with the reason named** — falling back to a human is always the safe
failure, and it is never silent.

## The handoff

`lib/marketing/publish/create-post-from-content-item.ts`, modelled line-for-line
on `lib/social/create-post-from-render.ts`.

```text
1  guard getPublishingEnvironment().ENABLE_SOCIAL_POSTING
2  load the content item workspace-scoped
   reject unless status === "approved"
   reject unless kind in { social_post, graphic, media_story }
3  re-verify every attached media asset is `ready` and belongs to this workspace
   via findReadyMediaAssets
4  createSocialPostForContentItem(...)   -- one transaction
5  write social_post_id back onto the content item
6  optionally scheduleSocialPostPublication(...)   -- existing, unchanged
```

### Step 3 is not paranoia

The foreign key alone would happily accept another workspace's asset id from a
crafted request. `create-post-from-render.ts` makes the identical check on the
render id and says so in a comment. Copy the check and the comment.

### Step 4 — the new command

`createSocialPostForContentItem` in `db/commands/social-post-commands.ts`,
sibling of the existing `createSocialPostForRender`. In one transaction:

- insert `social_posts` with `body_document` **copied verbatim**,
- `body_plain_text = renderPortableDocumentToPlainText(bodyDocument)` **derived
  on the server**, never taken from the browser — this is the text that will
  actually be published,
- `project_id: null` (marketing content has no project),
- insert `social_post_media` rows in position order.

The copy is trivial precisely because `marketing_content_items.body_document`
reuses the existing `PortableDocument` type and `marketing_content_media`
mirrors the `social_post_media` XOR invariant. That reuse is the whole reason
the handoff is a row copy and not a conversion with its own bug surface.

### Step 6 — scheduling

If the user asked to schedule, call the **existing, unchanged**
`scheduleSocialPostPublication({ workspaceId, postId, scheduledAt, timezone, connectionIds, requestNonce })`.

It performs eligibility checking against the capability matrix, validates the
schedule instant, and creates the target rows — all of it already built and
tested. Only on success does the content item move to `scheduled`.

If scheduling fails, or was not requested, the item stays `approved`, the post
stays `draft`, and the UI links to `/app/social/posts/{postId}` — the composer
the user already knows, with the per-platform previews and character counters
they have already learned.

### What the handoff must not do

```text
must not call a platform provider
must not create social_post_targets directly
must not re-implement eligibility checking
must not derive body_plain_text on the client
must not copy media bytes (attach by reference)
```

## Scheduled-for is intent, not truth

`marketing_content_items.scheduled_for` records what the user asked for.

Once handed off, **`social_posts.scheduled_at` is authoritative.** The existing
`social-post-scheduler` cron claims from `social_posts`, and nothing in
marketing may contradict it. Rescheduling an already-handed-off item updates the
post through the existing action and mirrors the value back.

This split is deliberate: the sweeper's claim query
(`social_posts_due_index`) must have exactly one source of due work.

## Calendar read model

`lib/marketing/calendar/load-marketing-calendar.ts` merges three sources and
reuses the existing `groupPostsByDay` from `lib/social/schedule-calendar.ts`:

| Source                                                                      | Shown as                                        |
| --------------------------------------------------------------------------- | ----------------------------------------------- |
| Handed-off items — posts whose ids appear in `content_items.social_post_id` | Real status from `social_posts` (authoritative) |
| Not-yet-handed-off — `scheduled_for is not null and social_post_id is null` | Visually distinct **"not scheduled yet"** state |
| Planned occurrences — `schedule_rules.next_run_at`                          | Ghosted, future only                            |

The middle state matters. A user who set a date on a draft but never approved it
must not see it rendered identically to a post that is genuinely queued to
send — that is precisely the confusion that produces "why didn't it post?".

## Ad creative (paid)

Paid traffic in v1 is **creative and copy only**. No Ads API.

`kind: 'ad_creative'` content items carry a `structured_payload` validated by a
Zod discriminated union on `kind`:

```ts
{
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  platform: ContentPlatform;
  placement: string;
  variantLabel: string;
}
```

Ad items are **excluded from the handoff** — there is no organic publish path
for an ad. They are exported: copy to clipboard, or download as CSV for bulk
upload into Ads Manager. The campaign's Ads tab lists variants side by side for
comparison.

`marketing_campaigns.traffic_type` (`organic | paid | both`) drives which tabs
appear and which prompt variant is used. Paid copy has different constraints —
character limits per placement, no misleading claims, platform ad policy — and
those live in the paid prompt template, not in a shared one with an `if`.

## Other content kinds

| Kind          | Handoff              | Notes                                                              |
| ------------- | -------------------- | ------------------------------------------------------------------ |
| `social_post` | Yes                  | The primary path                                                   |
| `graphic`     | Yes                  | Carries a generated image as `marketing_content_media`             |
| `media_story` | Yes                  | Vertical-first; eligibility still decided by the capability matrix |
| `ad_creative` | **No** — export only |                                                                    |
| `blog_post`   | **No** — export only | Markdown/HTML export; no CMS integration in v1                     |
| `email`       | **No** — export only | No ESP integration in v1                                           |
| `newsletter`  | **No** — export only | Same                                                               |

Email and newsletter deliberately stop at a reviewed draft. Sending email needs
a provider, a suppression list, unsubscribe handling, and deliverability
reputation — an entire feature, not a skill.

## Revisions

Every accepted edit writes a `marketing_content_revisions` row with
`change_source: 'ai' | 'human'`. The history tab shows who or what changed
what and when, and any revision can be restored as a new revision — never by
mutating history, matching the script-version behaviour already in the app.

## Required behaviour

```text
only approved items of a handoff-eligible kind can be handed off
attached assets are re-verified as ready and workspace-owned
body_plain_text is derived on the server from the validated document
one content item maps to at most one social post
marketing never creates social_post_targets
scheduling goes through the existing scheduleSocialPostPublication
social_posts.scheduled_at is authoritative after handoff
the calendar distinguishes intent from a real queued send
ad creative cannot be handed off
status transitions are validated server-side
```

## Required tests

```text
handoff refuses a draft, a changes_requested, and an already-handed-off item
handoff refuses a cross-workspace media asset id
handoff refuses ad_creative, blog_post, email, newsletter
body_plain_text matches renderPortableDocumentToPlainText of the copied document
partial unique index prevents a second post for one content item
content status transition table is exhaustive and rejects illegal moves
calendar renders intent and queued sends as distinct states
ad creative export produces one row per variant
```
