# Marketing Studio — cost governance

This feature generates text, images, and research on a schedule, from a chat, at
the request of a language model deciding for itself how many tools to call. It
is the most spend-capable surface in the application. AGENTS.md's rule applies
without exception: **never silently spend money.**

## Why a separate ledger

Stated in full in `01-data-model.md`; summarised here because it is the reason
this document exists at all.

`usage_reservations.projectId` is `NOT NULL`, and marketing work belongs to no
project. Its `usage_reservations_single_operation` CHECK is a seven-branch OR
that has broken **twice** under `drizzle-kit push`, each time producing a silent
constraint violation that rolled back an entire reservation CTE.

The marketing ledger has one non-null FK to one table, with the polymorphism in
an enum column, and a **plain total unique index** rather than a partial one.
There is no multi-column predicate for a schema differ to serialise wrongly.

## The shared budget — do not skip this

**The workspace budget is one budget.**

`lib/budgets/committed-spend.ts` (new, shared) sums committed cents across
**both** `usage_reservations` and `marketing_usage_reservations` for a window:

```ts
committed = sum(
  case when status = 'pending' then reserved_cost_cents
       else coalesce(actual_cost_cents, 0) end
)
```

Both `getWorkspaceUsageSummary` and the marketing reservation path read through
it.

Without this, the video pipeline and the marketing team each independently
observe the full daily allowance, and together spend double it. **This is the
most likely money bug in the feature.** It ships with the ledger in Slice 3, not
after, and it gets an explicit test.

## Operations

`marketing_operation` enum:

| Operation             | Provider        | Typical cost driver              |
| --------------------- | --------------- | -------------------------------- |
| `chat_turn`           | OpenAI          | System prompt + history + output |
| `content_draft`       | OpenAI          | Brand context + brief            |
| `ad_creative_copy`    | OpenAI          | Variants requested               |
| `blog_post`           | OpenAI          | Target word count                |
| `email_draft`         | OpenAI          |                                  |
| `newsletter_draft`    | OpenAI          | Sections                         |
| `campaign_plan`       | OpenAI          | Duration × platforms             |
| `media_story`         | OpenAI          |                                  |
| `document_summary`    | OpenAI          | Document length                  |
| `competitor_analysis` | Tavily + OpenAI | Queries + synthesis              |
| `trend_scan`          | Tavily + OpenAI | Queries + synthesis              |
| `image_generation`    | OpenAI          | Image count × quality            |

### Free operations — no ledger row

```text
skill catalogue reads
calendar reads
brand context compilation
search_brand_knowledge          (a Postgres query)
scheduling an already-generated item
the handoff to social_posts
```

Publishing is already deliberately off-ledger in this repository — uploads cost
no money, platforms meter by quota — and that stays true. Do not "fix" it by
adding a zero-cost reservation; it would pollute spend reporting.

## Enforcement points

There are four, and they are independent on purpose.

### 1. Reservation — the one money-safe entry point

`lib/marketing/usage/reserve-marketing-usage.ts`. In a single transaction under
a per-workspace advisory lock (`pg_advisory_xact_lock`, matching
`createScriptGenerationReservation`):

```text
load loadEffectiveWorkspaceBudget({ workspaceId })
compute committed spend for day and month via committed-spend.ts
compare against daily, monthly, and the marketing sub-cap
insert the reservation, or throw MarketingBudgetExceededError(scope)
```

`MarketingBudgetExceededError` is a new typed domain error in
`lib/domain/errors.ts`, carrying which limit was hit
(`workspace_daily | workspace_monthly | marketing_monthly | schedule_rule`) so
the UI can say something useful.

`expires_at = now + GENERATION_RESERVATION_EXPIRY_MINUTES`, reusing the existing
setting.

### 2. Trigger preflight

Every marketing task re-checks, **before touching a provider**, that:

```text
the reservation exists and status = 'pending'
expires_at > now
reserved_cost_cents === run.estimated_cost_cents
run.request_fingerprint === createRequestFingerprint(secret, run.final_prompt)
```

Copy the block from `trigger/thumbnail-generation.ts` verbatim. It is what stops
a replayed Trigger run, or a tampered row, from spending twice. The fingerprint
comparison specifically catches a prompt that changed between reservation and
execution.

Terminal-status early return comes first: a run already `succeeded` or `failed`
returns without calling anything.

### 3. Reconcile and release

| Outcome                            | Action                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Success                            | `reconcileMarketingUsage(runId, actualCostCents)` + a `usage_events` row |
| Failure (no spend)                 | Release; `actual_cost_cents = 0`                                         |
| Failure (provider may have billed) | **Reconcile at the reserved amount**, not release                        |
| Cancel                             | Release                                                                  |
| Expiry                             | Released by the hourly reconciler                                        |

The third row matters. `classifyImageGenerationError` already reports
`providerMayHaveAcceptedRequest`; `trigger/thumbnail-generation.ts` already uses
it to charge the reserved amount rather than under-record a possible bill. Apply
the same rule here — under-recording spend is worse than over-recording it.

`trigger/marketing-usage-reconcile.ts` (hourly) releases pendings past
`expires_at` and settles chat messages stuck in `streaming`, mirroring
`lib/reconciliation/stale-workflow.ts`.

### 4. Rate limits

Extend the `RateLimitedOperation` union in
`lib/rate-limit/enforce-rate-limit.ts`:

```text
marketing_chat_turn
marketing_content_generation
marketing_image_generation
marketing_research
```

Chat is chatty by nature and needs its own ceiling:
`RATE_LIMIT_MARKETING_CHAT_PER_WINDOW` (default 20), branched alongside the
existing `video_render` branch. The others use
`RATE_LIMIT_GENERATIONS_PER_WINDOW`.

Rate limiting is enforced in the web runtime **before any reservation is
created**, exactly as it is today.

## Sub-caps

Budgets nest. Each is a ceiling inside the one above it.

| Cap                                                 | Scope                      |
| --------------------------------------------------- | -------------------------- |
| `DEFAULT_DAILY_BUDGET_CENTS` / monthly              | Workspace (existing)       |
| `marketing_settings.monthly_marketing_budget_cents` | Marketing within workspace |
| `marketing_settings.daily_max_generated_items`      | Item count, not cost       |
| `marketing_schedule_rules.monthly_budget_cents`     | One recurring rule         |
| `MARKETING_CHAT_MAX_TURN_COST_CENTS`                | One chat turn              |

A schedule rule that would breach its cap records
`skip_reason: 'budget_exhausted'` and **auto-pauses after 3 consecutive skips**
with a `paused_reason` the UI shows. A rule that silently stops working is worse
than one that says why it stopped.

`MARKETING_CHAT_MAX_TURN_COST_CENTS` is enforced by `prepareStep` dropping
billable tools mid-turn — a step limit alone does not bound cost, because six
image generations fit inside six steps.

## Visibility

### Before spending

Every billable skill shows its estimate before it runs. An estimate at or above
`manualConfirmationThresholdCents` requires an explicit confirmation checkbox.
The threshold is the workspace's existing setting, read through
`loadEffectiveWorkspaceBudget`, so the UI's disable state and the server's guard
cannot diverge.

### After spending

`/app/usage` gains a marketing section:

- `db/repositories/marketing-usage-summary.repository.ts` returns the same
  rollup shape as `usage-summary.repository.ts`, grouped by **operation** and
  **campaign** rather than by project.
- `lib/usage/marketing-usage-ledger.ts` provides `MARKETING_OPERATION_LABELS`
  and `MARKETING_OPERATION_PROVIDERS`, mirroring the existing label maps.
- `components/usage/MarketingUsageSection.tsx` renders it.

Thread-level cost is also visible in the chat itself
(`components/marketing/ChatCostFooter.tsx`) — per turn and per thread. A user
should never have to leave the conversation to find out what it cost.

## Environment variables

New group: `marketingEnvironmentSchema` in `lib/env/server-schema.ts`,
`getMarketingEnvironment()` in `lib/env/server.ts`, and `.env.example` kept in
sync (AGENTS.md git rule 6).

| Variable                               | Runtime | Purpose                              |
| -------------------------------------- | ------- | ------------------------------------ |
| `ENABLE_MARKETING_STUDIO`              | Both    | Feature flag                         |
| `MARKETING_CHAT_MODEL`                 | Vercel  | Chat model id                        |
| `MARKETING_CHAT_MAX_STEPS`             | Vercel  | Default 6                            |
| `MARKETING_CHAT_MAX_TURN_COST_CENTS`   | Vercel  | Default 25                           |
| `MARKETING_BRAND_CONTEXT_MAX_TOKENS`   | Both    | Default 2500                         |
| `MARKETING_MAX_DOCUMENTS`              | Both    | Default 200 — the RAG threshold      |
| `MARKETING_MAX_DOCUMENT_BYTES`         | Both    | Upload ceiling                       |
| `MARKETING_RESEARCH_PROVIDER`          | Both    | `tavily \| brave \| serpapi \| none` |
| `TAVILY_API_KEY`                       | Both    | Optional, validated lazily           |
| `MARKETING_RESEARCH_FRESHNESS_DAYS`    | Both    | Default 7                            |
| `MARKETING_RESEARCH_MAX_QUERIES`       | Trigger | Per run                              |
| `MARKETING_RESEARCH_DAILY_MAX_RUNS`    | Trigger | Refresh ceiling                      |
| `MARKETING_SCHEDULER_BATCH_SIZE`       | Trigger | Sweeper claim size                   |
| `MARKETING_IMAGE_MODEL`                | Both    |                                      |
| `MARKETING_IMAGE_QUALITY`              | Both    |                                      |
| `RATE_LIMIT_MARKETING_CHAT_PER_WINDOW` | Vercel  | Default 20                           |

**Both runtimes** means Vercel **and** Trigger.dev. Cost and limit values must
match in both, or worker-side actual costs will reconcile against web-side
estimates that were computed under different rules — the same trap already
documented for the Phase 9 render variables.

`.env.trigger.dev` is pushed by `syncEnvVars` **on deploy**. A change to it is
inert until the worker is redeployed.

## Required behaviour

```text
committed spend is summed across both ledgers
a reservation is created before any provider call
the Trigger preflight re-verifies status, expiry, amount, and fingerprint
a possibly-billed failure reconciles at the reserved amount, not zero
rate limits are enforced before a reservation is created
cost is shown before every billable action
an over-threshold estimate requires explicit confirmation
a schedule rule that hits its cap records why and eventually pauses
marketing spend appears in /app/usage
no marketing operation can spend without a marketing_generation_runs row
```

## Required tests

```text
committed-spend sums both ledgers for daily and monthly windows
a workspace at its daily limit is refused by the marketing path
a workspace at its marketing sub-cap is refused while the workspace budget allows
reservation is idempotent on an identical idempotency key
preflight rejects an expired reservation
preflight rejects a mismatched amount
preflight rejects a changed request fingerprint
possibly-billed failure charges the reserved amount
reconciler releases pendings past expiry
reconciler settles messages stuck in streaming
prepareStep drops billable tools past the per-turn ceiling
schedule rule auto-pauses after three consecutive budget skips
```
