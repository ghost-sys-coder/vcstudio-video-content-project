# Marketing Studio — data model

Every table goes in `db/schema.ts` (one file, ~3,700 lines — there is no
per-domain split to follow). Every table is prefixed `marketing_`, every enum is
prefixed `marketing_`, and every table carries:

```ts
workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
```

## Migration rules for this feature

These are not general advice; they are specific mitigations for failures this
repository has already had.

1. **`drizzle-kit generate` + `drizzle-kit migrate`. Never `push`.** `push`
   silently skips changed CHECK expressions and partial-index predicates. Both
   have caused live outages here.
2. **One table-adding slice at a time.** `db/schema.ts` is a single file and the
   riskiest merge surface in this feature.
3. **Every new CHECK is single-column and short.** No multi-column XOR
   predicates. See the ledger rationale below.
4. **Verify by hand after applying** — `pg_indexes`, `pg_constraint`,
   `pg_get_constraintdef`, `pg_enum`.

## Why the marketing ledger is not `usage_reservations`

Two independent reasons, both decisive.

**`usage_reservations.projectId` is `NOT NULL`.** Marketing work is
workspace-scoped: a brand profile, a competitor analysis, and a chat turn belong
to no project. Making that column nullable would require rewriting the CHECK
constraint that guards every existing money path.

**That CHECK is a seven-branch OR that has broken twice.** For each
`operation_type`, exactly one of seven nullable FK columns must be non-null and
the other six null. Adding an eighth operation means an eighth branch, and both
times a branch was added, `drizzle-kit push` left the old definition in place —
producing a constraint violation that rolled back the whole reservation CTE and
surfaced as a generic "could not be generated" message with zero rows written.

The new ledger is shaped so that failure mode **cannot recur**:

- `marketing_usage_reservations` has exactly **one non-null FK**, to
  `marketing_generation_runs`.
- The polymorphism lives in `marketing_generation_runs.operation`, an enum
  column.
- Its uniqueness guarantee is a **plain, total** unique index on `(run_id)` — no
  partial predicate for the tooling to serialise incorrectly.

There is nothing here for a schema differ to get wrong, because there is no
`sql\`\`` predicate spanning several columns.

## Shared budget

The workspace budget is **one budget**. A new shared helper
`lib/budgets/committed-spend.ts` sums committed cents across **both**
`usage_reservations` and `marketing_usage_reservations` for a window.

Without it, the video pipeline and the marketing team each independently observe
the full daily allowance and together spend double. This is the single most
likely money bug in the feature and must ship with the ledger, not after it.

## Tenant-composite foreign keys

Where a marketing row points at an existing workspace-scoped row, use a
composite FK on `(id, workspaceId)` rather than `(id)` alone:

```ts
foreignKey({
  columns: [table.mediaAssetId, table.workspaceId],
  foreignColumns: [mediaAssets.id, mediaAssets.workspaceId],
}).onDelete("restrict");
```

This uses the existing `media_assets_id_workspace_unique` index and makes
cross-workspace attachment impossible **in the database**, not merely in the
query layer. It is the pattern already used by
`usage_reservations_tenant_generation_fkey`.

## Decision: do not widen `media_asset_kind`

Knowledge documents get their **own table and their own storage prefix**. Do not
add `document` to the `media_asset_kind` enum.

`media_assets` is consumed by at least eight call sites that branch on
`image | video`:

```text
MEDIA_ASSET_KIND_BY_CONTENT_TYPE   lib/schemas/media-asset.ts
checkMediaUpload                   lib/media/media-upload-limits.ts
inspectMediaAsset                  lib/storage/media-asset-storage.ts   (sharp cannot decode a PDF)
summarizeAttachments               lib/social/select-eligible-platforms.ts
loadMediaLibrary                   lib/media/load-media-library.ts
MediaKindFilter                    components/social/MediaKindFilter.tsx
MediaAssetPreview                  components/social/MediaAssetPreview.tsx
MediaPickerDialog                  components/social/MediaPickerDialog.tsx
```

A PDF reachable from the post composer's media picker is a bug waiting to
happen, and documents are never attached to a post. The enum widening itself
would be a safe additive migration — the risk is entirely in the consumers.

## Tables

### Brand and business

**`marketing_brand_profiles`** — one row per workspace.

| Column                                                                      | Notes                                  |
| --------------------------------------------------------------------------- | -------------------------------------- |
| `id`, `workspace_id`                                                        | **uniqueIndex on `workspace_id`**      |
| `business_name`, `website_url`, `one_liner`, `long_description`, `industry` |                                        |
| `primary_language` (default `English`), `timezone`                          |                                        |
| `brand_voice_summary`, `tone_attributes jsonb`, `writing_rules jsonb`       |                                        |
| `banned_phrases jsonb`, `value_props jsonb`, `proof_points jsonb`           |                                        |
| `compliance_notes`                                                          |                                        |
| `onboarding_status` enum `not_started \| in_progress \| complete`           |                                        |
| `onboarding_completed_at`                                                   |                                        |
| `context_version integer not null default 1`                                | bumped on any change affecting context |
| `updated_by_user_id`                                                        | `→ users(id) restrict`                 |

`context_version` is load-bearing: it makes the compiled brand context
reproducible per generation, satisfying AGENTS.md's requirement that prompt
changes must not alter the reproducibility of previous generations.

**`marketing_brand_audiences`** — `brand_profile_id → cascade`, `name`,
`description`, `pain_points jsonb`, `geography`, `buying_triggers jsonb`,
`is_primary boolean`, `position integer`.
Index `(workspace_id, brand_profile_id, position)`. **Partial uniqueIndex on
`(brand_profile_id)` where `is_primary`** — exactly one primary audience.

**`marketing_brand_offers`** — `brand_profile_id`, `name`, `summary`,
`price_model`, `audience_id nullable → set null`, `differentiators jsonb`,
`position`.

**`marketing_brand_channels`** — `platform contentPlatformEnum`, `handle`,
`cadence_per_week integer`, `tone_override`, `hashtag_strategy`,
`is_branded_default boolean default true`.
**uniqueIndex `(workspace_id, platform)`**. Check `cadence_per_week between 0 and 50`.

**`marketing_onboarding_answers`** — the raw Q&A, deliberately kept separate
from the synthesised profile so re-synthesis never loses what the user actually
said. `question_key text`, `answer_text text`, `answered_by_user_id`.
**uniqueIndex `(workspace_id, question_key)`**.

The question catalogue is **code**, not rows —
`lib/marketing/brand/onboarding-questions.ts` exports a frozen versioned array.
Data-driven UI, code-owned contract, unit-testable.

### Grounding

**`marketing_brand_assets`** — joins existing library media to a brand role.
`media_asset_id`, `role` enum `marketing_brand_asset_role`
(`logo_primary | logo_alt | logo_mark | wordmark | product_shot | team_photo | brand_pattern | font_specimen | screenshot | other`),
`notes`, `position`.
uniqueIndex `(workspace_id, media_asset_id)`. Partial uniqueIndex
`(workspace_id, role)` where `role = 'logo_primary'`.
**Tenant-composite FK** on `(media_asset_id, workspace_id)`, `on delete restrict`.

**`marketing_knowledge_documents`** — own storage, own two-phase upload.

| Column                                                                      | Notes                                                 |
| --------------------------------------------------------------------------- | ----------------------------------------------------- |
| `title`, `source_kind` enum `upload \| pasted \| url_capture`, `source_url` |                                                       |
| `object_key text` (nullable for pasted), `content_type`, `size_bytes`       | uniqueIndex on `object_key` where not null            |
| `original_file_name`                                                        | sanitised, never trusted from the browser             |
| `status` enum `pending \| extracting \| ready \| failed`                    |                                                       |
| `extracted_text text`, `extracted_character_count`, `token_estimate`        |                                                       |
| `summary text`, `key_facts jsonb`                                           | what actually reaches the prompt                      |
| `checksum text`                                                             | sha256 of extracted text — summariser idempotency key |
| `include_in_context boolean default true`, `priority integer default 0`     |                                                       |
| `error_category`, `safe_error_message`, `created_by_user_id`, `deleted_at`  | soft delete                                           |

Indexes: `(workspace_id, status)`,
`(workspace_id, include_in_context, priority, created_at)`, and a **GIN index**
on `to_tsvector('english', extracted_text)` — this is the retrieval mechanism
(see `02-brand-grounding.md`).

Storage key: new `createMarketingDocumentObjectKey` in `lib/storage/object-key.ts`
→ `workspaces/{ws}/marketing/documents/{documentId}.{ext}`, plus its
`isMarketingDocumentObjectKey` twin. Deliberately outside
`createProjectAssetPrefix`, for the same reason library keys are: deleting a
project must never purge it.

**`marketing_brand_context_snapshots`** — immutable compiled context.
`context_version integer`, `block_text text`, `token_estimate`,
`source_fingerprint text`, `prompt_version text`.
uniqueIndexes `(workspace_id, context_version)`,
`(workspace_id, source_fingerprint)`, and `(id, workspace_id)` so runs can carry
a tenant-composite FK.

### Chat

**`marketing_chat_threads`** — `title` (auto-titled from the first user
message), `status` enum `active | archived`, `created_by_user_id`,
`last_message_at`, `message_count`, `total_cost_cents`.
Index `(workspace_id, status, last_message_at desc)`. uniqueIndex `(id, workspace_id)`.

**`marketing_chat_messages`** —
`thread_id → cascade`, `role` enum `user | assistant | system | tool`,
`parts jsonb` (AI SDK UIMessage parts, validated by
`marketingChatMessagePartsSchema`), `plain_text text`, `position integer`,
`request_nonce uuid nullable`, `model_id`, `prompt_version`,
`brand_context_snapshot_id nullable`, `run_id nullable`, `input_tokens`,
`output_tokens`, `cost_cents`, `status` enum `streaming | complete | failed`,
`finish_reason`, `provider_request_id`, `safe_error_message`.

- **uniqueIndex `(thread_id, position)`** — append is monotonic; a retried
  request cannot double-append.
- **Partial uniqueIndex `(thread_id, request_nonce)` where `request_nonce is not null`** —
  request idempotency.
- Tenant-composite FK on `(thread_id, workspace_id)`.

**`marketing_chat_tool_calls`** —
`thread_id`, `message_id → cascade`, `tool_call_id text` (the provider's id),
`skill_key text`, `user_skill_id nullable → set null`, `input jsonb`,
`output jsonb`, `status` enum `marketing_tool_call_status`
(`pending | running | succeeded | failed | cancelled`), `run_id nullable`,
`trigger_run_id`, `estimated_cost_cents`, `actual_cost_cents`, `started_at`,
`completed_at`, `error_category`, `safe_error_message`.
**uniqueIndex `(thread_id, tool_call_id)`**. Index `(workspace_id, status)` —
this is the "is anything still running?" query that drives polling.

A separate table rather than living only inside `parts`, because deferred work
resolves minutes later in a Trigger worker that must update **one row**
atomically rather than rewrite a jsonb array — and because "which skill ran,
what did it cost, did it fail" has to be queryable.

### Work and money

**`marketing_generation_runs`** — the single money-bearing operation record for
the entire feature. One table rather than seven parallel `*_generation_runs`
tables, satisfying AGENTS.md's "every provider operation must record …" list in
one place.

`operation marketing_operation`, `skill_key nullable`, `user_skill_id nullable`,
`thread_id nullable`, `tool_call_id nullable`, `campaign_id nullable`,
`content_item_id nullable`, `competitor_id nullable`, `schedule_rule_id nullable`,
`status` enum `pending | running | succeeded | failed | cancelled`,
`provider`, `model`, `prompt_version`, `brand_context_snapshot_id nullable`,
`final_prompt text`, `request_fingerprint text`, `idempotency_key text`,
`input_tokens`, `output_tokens`, `image_count`, `estimated_cost_cents`,
`actual_cost_cents`, `provider_request_id`, `trigger_run_id`, `attempt_count`,
`error_category`, `safe_error_message`, `requested_by_user_id`, `started_at`,
`completed_at`.

- **uniqueIndex on `idempotency_key`**.
- uniqueIndex `(id, workspace_id)`.
- Index `(workspace_id, operation, created_at desc)`, `(workspace_id, status)`.
- All link columns are `on delete set null`, and **there is deliberately no XOR
  check across them** — a run may legitimately reference a thread _and_ a
  content item _and_ a campaign.

**`marketing_usage_reservations`** —
`run_id uuid **not null** → marketing_generation_runs(id) cascade`,
`operation marketing_operation`,
`status usageReservationStatusEnum` (**reuse** the existing
`pending | reconciled | released` enum — same semantics, no parallel vocabulary),
`reserved_cost_cents integer not null`, `actual_cost_cents nullable`,
`expires_at timestamptz not null`.

- **uniqueIndex `(run_id)`** — plain and total. One reservation per operation.
- uniqueIndex `(id, workspace_id)`.
- Index `(workspace_id, status, created_at)`, `(status, expires_at)`.
- Tenant-composite FK `(run_id, workspace_id)`.
- Check `marketing_usage_reservations_cost_nonnegative` — single-column, short.
- **No `project_id`. No seven-column XOR.**

**`marketing_usage_events`** — `reservation_id not null`, `operation`,
`event_type usageEventTypeEnum` (reused), `estimated_cost_cents`,
`actual_cost_cents`, `safe_metadata jsonb`.
uniqueIndex `(reservation_id, event_type)` — one reserve, one settle, one
release, ever. Tenant-composite FK `(reservation_id, workspace_id)` cascade.

### Content

**`marketing_campaigns`** — `name`, `objective` enum
(`awareness | traffic | leads | sales | retention | hiring`),
`traffic_type marketing_traffic_type` (`organic | paid | both`),
`status` enum (`draft | active | paused | completed | archived`),
`start_date date`, `end_date date nullable`, `audience_id nullable`,
`offer_id nullable`, `key_message`, `hypothesis`, `platforms jsonb`,
`brief_document jsonb`, `brief_plain_text`, `is_branded boolean default true`.
Index `(workspace_id, status, start_date)`. uniqueIndex `(id, workspace_id)`.
Check `end_date is null or end_date >= start_date`.

A content item belongs to **at most one** campaign. Cross-campaign reuse is a
v2 problem and a join table now buys nothing.

**`marketing_content_items`** — the central artifact.

| Column                                                                | Notes                                                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `campaign_id nullable`, `schedule_rule_id nullable`                   | both `set null`                                                                                            |
| `kind marketing_content_kind`                                         | `social_post \| ad_creative \| blog_post \| email \| newsletter \| media_story \| graphic`                 |
| `platform contentPlatformEnum nullable`, `traffic_type`, `is_branded` |                                                                                                            |
| `title text`                                                          |                                                                                                            |
| `body_document jsonb $type<PortableDocument>`                         | **reuses the existing portable document** — this is what makes the handoff a copy rather than a conversion |
| `body_plain_text text`                                                | derived on the server                                                                                      |
| `structured_payload jsonb`                                            | kind-discriminated; validated by `marketingContentPayloadSchema`                                           |
| `status marketing_content_status`                                     | `draft \| needs_review \| changes_requested \| approved \| scheduled \| published \| archived \| failed`   |
| `source_run_id nullable`, `brand_context_snapshot_id nullable`        | provenance                                                                                                 |
| `reviewed_by_user_id`, `reviewed_at`, `review_notes`                  |                                                                                                            |
| `scheduled_for timestamptz nullable`, `scheduled_timezone`            | **intent only** — authoritative schedule lives on `social_posts`                                           |
| `social_post_id nullable → social_posts set null`, `published_at`     |                                                                                                            |
| `version integer default 1`                                           | optimistic lock, same as `social_posts`                                                                    |

- uniqueIndex `(id, workspace_id)`.
- **Partial uniqueIndex `(workspace_id, social_post_id)` where `social_post_id is not null`** —
  one content item per post, no fan-out.
- Index `(workspace_id, status, scheduled_for)`,
  `(workspace_id, campaign_id, created_at)`,
  `(workspace_id, kind, created_at desc)`.
- Check `status <> 'scheduled' or scheduled_for is not null` — mirrors
  `social_posts_scheduled_requires_time`.

**`marketing_content_media`** — `content_item_id → cascade`,
`media_asset_id nullable → restrict`, `render_id nullable → restrict`,
`position`. uniqueIndexes `(content_item_id, position)`,
`(content_item_id, media_asset_id)`, `(content_item_id, render_id)`; check
`(media_asset_id is not null) <> (render_id is not null)`.

A byte-for-byte copy of the `social_post_media` invariant, so the handoff is a
row copy.

**`marketing_content_revisions`** — `content_item_id → cascade`,
`version integer`, `body_document`, `body_plain_text`, `structured_payload`,
`change_source` enum `ai | human`, `changed_by_user_id nullable`,
`run_id nullable`. uniqueIndex `(content_item_id, version)`.

### Research

**`marketing_competitors`** — `name`, `website_url nullable`,
`handles jsonb $type<Partial<Record<ContentPlatform, string>>>`, `notes`,
`priority`, `is_active boolean default true`, `last_researched_at`,
`created_by_user_id`, `deleted_at`.
Partial uniqueIndex `(workspace_id, website_url)` where `website_url is not null and deleted_at is null`.
Index `(workspace_id, is_active, priority)`. uniqueIndex `(id, workspace_id)`.

**`marketing_research_snapshots`** — `kind marketing_research_kind`
(`competitor | trend | keyword | audience`), `competitor_id nullable → cascade`,
`topic text`, `queries jsonb` (what was actually issued), `provider`,
`provider_request_id`, `status` enum `pending | running | succeeded | failed`,
`result_document jsonb` (validated by `researchSnapshotSchema`),
`citations jsonb`, `result_hash`, `freshness_window_days`,
`expires_at timestamptz`, `run_id nullable`, `error_category`,
`safe_error_message`.
Index `(workspace_id, kind, created_at desc)`,
`(workspace_id, competitor_id, created_at desc)`, `(workspace_id, expires_at)`.
Check `(kind = 'competitor') = (competitor_id is not null)` — single-column
comparison, safe to express.

Citations stay in `jsonb` for v1. A normalised sources table is only worth it
with dedupe or click tracking, neither of which exists.

### Automation

**`marketing_schedule_rules`** — `name`, `is_enabled`, `campaign_id nullable`,
`skill_key text`, `content_kind`, `platforms jsonb`, `traffic_type`,
`is_branded`, `prompt_brief text`, `frequency` enum
`daily | weekly | monthly`, `by_weekday jsonb`, `by_month_day integer nullable`,
`time_of_day_minutes integer`, `timezone text`, `lead_time_minutes`,
`max_items_per_run integer default 1`, `auto_approve boolean default false`,
`auto_schedule boolean default false`, `monthly_budget_cents nullable`,
`next_run_at timestamptz nullable`, `last_run_at`,
`consecutive_failure_count`, `paused_reason text`, `created_by_user_id`.

- **Index `(is_enabled, next_run_at)`** — the sweeper's claim query, global by
  design, exactly like `social_posts_due_index`.
- Index `(workspace_id, is_enabled)`.
- Checks: `time_of_day_minutes between 0 and 1439`;
  `max_items_per_run between 1 and 10`;
  `frequency <> 'monthly' or by_month_day between 1 and 28` — **28, not 31**, so
  a rule can never silently skip a month.

**`marketing_schedule_rule_runs`** — `rule_id → cascade`,
`scheduled_for timestamptz`, `claimed_at`, `status` enum
`claimed | running | succeeded | failed | skipped`, `skip_reason text`,
`created_content_item_ids jsonb`, `run_id nullable`, `trigger_run_id`,
`error_category`, `safe_error_message`.
**uniqueIndex `(rule_id, scheduled_for)`** — the idempotency guard. Two
overlapping sweeps cannot create two items for the same occurrence, with no
distributed lock required.

Claiming uses `FOR UPDATE SKIP LOCKED`, copied from `claimDueSocialPosts` in
`db/commands/social-post-schedule-commands.ts`.

### Settings

**`marketing_settings`** — `workspace_id` (uniqueIndex), `autonomy_level` enum
`manual | assisted | autonomous` default `manual`,
`require_approval_before_publish boolean default true`, `default_timezone`,
`default_platforms jsonb`, `default_language`,
`branded_default boolean default true`, `monthly_marketing_budget_cents nullable`,
`daily_max_generated_items integer default 10`,
`research_refresh_days integer default 7`, `updated_by_user_id`.

**`marketing_skills`** — user-authored only; built-ins are code. See
`03-skills.md` for the full contract.
`slug text`, `name`, `description`, `instructions text`, `base_skill_key text`,
`input_fields jsonb`, `default_platform nullable`, `default_content_kind`,
`is_enabled`, `version integer default 1`, `created_by_user_id`, `deleted_at`.
**Partial uniqueIndex `(workspace_id, slug)` where `deleted_at is null`.**
Checks `char_length(instructions) <= 8000`,
`jsonb_array_length(input_fields) <= 10`.

## Audit

Destructive marketing actions — delete competitor, delete user skill, archive
campaign, approve content — add **new values to the existing `auditActionEnum`**
and write to the existing `audit_log_events` table. No parallel audit log.

## Migration order

One migration per slice, in slice order (see `08-slices.md`):

```text
1  marketing_settings
2  marketing_brand_profiles, _brand_audiences, _brand_offers, _brand_channels, _onboarding_answers
3  marketing_knowledge_documents, marketing_brand_assets
4  marketing_generation_runs, marketing_usage_reservations, marketing_usage_events
5  marketing_brand_context_snapshots
6  marketing_chat_threads, marketing_chat_messages
7  marketing_chat_tool_calls
8  marketing_content_items, _content_media, _content_revisions
9  marketing_campaigns
10 marketing_competitors, marketing_research_snapshots
11 marketing_schedule_rules, marketing_schedule_rule_runs
12 marketing_skills
```

Enums are created in the migration of the first table that uses them.
`marketing_operation` is created with the ledger, in migration 4.
